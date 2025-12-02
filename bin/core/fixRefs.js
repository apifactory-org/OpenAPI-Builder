// bin/core/fixRefs.js

const { applyNamingConvention } = require('./namingConventions');

/**
 * Corrige los $ref dentro de un objeto OpenAPI, transformándolos a rutas relativas
 * correctas en función del tipo de contenido y la nueva estructura de carpetas.
 *
 * Estructura esperada:
 * src/
 *   ├── <mainFileName>.yaml          (entrypoint principal)
 *   ├── components/
 *   │   ├── schemas/
 *   │   ├── requestBodies/
 *   │   ├── responses/
 *   │   ├── parameters/
 *   │   ├── examples/
 *   │   └── headers/
 *   └── paths/
 *
 * Reglas de resolución:
 * - Desde paths/*:
 *   - "#/components/xxx/Name" → "../<mainFileName>.yaml#/components/xxx/Name"
 *
 * - Desde components/<type>/*:
 *   - "#/components/schemas/Name"              → "../schemas/<fileName>.yaml"
 *   - "#/components/<sameType>/Name"          → "../<sameType>/<fileName>.yaml"
 *   - "#/components/<otherType>/Name"         → "../<otherType>/<fileName>.yaml"
 *   (para responses, el nombre de archivo se asume igual al identificador)
 *
 * @param {object} content        Objeto con el contenido a corregir.
 * @param {string} componentType  Tipo lógico del contenido:
 *                                "paths", "schemas", "responses",
 *                                "requestBodies", "parameters", etc.
 * @param {string} mainFileName   Nombre del archivo principal SIN extensión.
 * @param {object} namingConfig   Configuración de nombres (convenciones).
 * @param {object} affixesConfig  Configuración de prefijos/sufijos de archivos.
 * @returns {object}              Objeto con referencias corregidas.
 */
function fixRefs(
  content,
  componentType,
  mainFileName = 'openapi',
  namingConfig = {},
  affixesConfig = {}
) {
  if (!content || typeof content !== 'object') {
    return content;
  }

  if (!mainFileName || typeof mainFileName !== 'string') {
    console.warn('⚠️  mainFileName no válido, usando default "openapi"');
    mainFileName = 'openapi';
  }

  let contentString = JSON.stringify(content);

  /**
   * Genera el nombre de archivo para un componente aplicando:
   *   - convención de nombres (PascalCase, etc.)
   *   - prefijos/sufijos por tipo (según affixesConfig)
   *
   * Debe ser consistente con la lógica usada en modularize.js
   * al crear los archivos de components/*.
   */
  function generateFileName(itemName, type) {
    let fileName = itemName;

    // Convención para nombres de componentes (archivo base, sin extensión)
    const convention = namingConfig.components || 'PascalCase';
    fileName = applyNamingConvention(fileName, convention);

    // Aplicar prefijos/sufijos si están habilitados
    if (affixesConfig.enabled) {
      const prefix =
        (affixesConfig.prefixes && affixesConfig.prefixes[type]) || '';
      const suffix =
        (affixesConfig.suffixes && affixesConfig.suffixes[type]) || '';

      if (prefix) fileName = prefix + fileName;
      if (suffix) fileName = fileName + suffix;
    }

    return fileName;
  }

  /**
   * Calcula la ruta relativa base según el origen y destino
   * Ejemplos:
   *   - fromType: 'paths'     → "../components/<toType>"
   *   - fromType: 'schemas'   → "../<toType>"
   *   - fromType: 'responses' → "../<toType>"
   */
  function getRelativePath(fromType, toType) {
    if (fromType === 'paths') {
      // Desde paths/* hacia components/<toType>/*
      return `../components/${toType}`;
    }
    // Desde components/<fromType>/* hacia components/<toType>/*
    return `../${toType}`;
  }

  // ─────────────────────────────────────────────
  // 1) Contenido dentro de components.schemas
  // ─────────────────────────────────────────────
  if (componentType === 'schemas') {
    // Referencias a otros schemas
    contentString = contentString.replace(
      /"#\/components\/schemas\/([^"]+)"/g,
      (match, name) => {
        const fileName = generateFileName(name, 'schemas');
        const relativePath = getRelativePath('schemas', 'schemas');
        return `"${relativePath}/${fileName}.yaml"`;
      }
    );
  }
  // ─────────────────────────────────────────────
  // 2) Contenido dentro de otros components/*
  //    (requestBodies, responses, securitySchemes, parameters, examples, headers)
  // ─────────────────────────────────────────────
  else if (
    [
      'requestBodies',
      'responses',
      'securitySchemes',
      'parameters',
      'examples',
      'headers',
    ].includes(componentType)
  ) {
    // 2.1 Referencias a schemas
    contentString = contentString.replace(
      /"#\/components\/schemas\/([^"]+)"/g,
      (match, name) => {
        const fileName = generateFileName(name, 'schemas');
        const relativePath = getRelativePath(componentType, 'schemas');
        return `"${relativePath}/${fileName}.yaml"`;
      }
    );

    // 2.2 Referencias al mismo tipo de componente
    const reSameType = new RegExp(
      `"#\\/components\\/${componentType}\\/([^"]+)"`,
      'g'
    );
    contentString = contentString.replace(reSameType, (match, name) => {
      // Para responses mantenemos el nombre tal cual (ya viene normalizado
      // por la lógica de modularización / responseNaming).
      const fileName =
        componentType === 'responses'
          ? name
          : generateFileName(name, componentType);

      const relativePath = getRelativePath(componentType, componentType);
      return `"${relativePath}/${fileName}.yaml"`;
    });

    // 2.3 Referencias a otros tipos de componentes (ej: headers que referencian parameters)
    contentString = contentString.replace(
      /"#\/components\/([a-zA-Z]+)\/([^"]+)"/g,
      (match, componentCategory, name) => {
        // Si ya lo manejamos arriba (schemas o mismo tipo) no lo cambiamos otra vez
        if (componentCategory === 'schemas' || componentCategory === componentType) {
          return match;
        }

        // Para responses, el nombre de archivo es el identificador
        const fileName =
          componentCategory === 'responses'
            ? name
            : generateFileName(name, componentCategory);

        const relativePath = getRelativePath(componentType, componentCategory);
        return `"${relativePath}/${fileName}.yaml"`;
      }
    );
  }
  // ─────────────────────────────────────────────
  // 3) Contenido dentro de paths/*
  // ─────────────────────────────────────────────
  else if (componentType === 'paths') {
    // Desde archivos de path, cualquier "#/components/..." debe apuntar
    // al entrypoint principal: "../<mainFileName>.yaml#/components/..."
    //
    // Ejemplo:
    //   "#/components/schemas/User" →
    //   "../main.yaml#/components/schemas/User"
    contentString = contentString.replace(
      /"#\/components\/([^"]+)"/g,
      (match, rest) => {
        return `"../${mainFileName}.yaml#/components/${rest}"`;
      }
    );
  }

  try {
    return JSON.parse(contentString);
  } catch (error) {
    console.error('Error parsing fixed refs:', error);
    return content;
  }
}

module.exports = { fixRefs };
