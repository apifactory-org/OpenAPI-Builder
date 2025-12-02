// bin/core/fixRefs.js

const { applyNamingConvention } = require('./namingConventions');

/**
 * Corrige los $ref dentro de un objeto OpenAPI, transformándolos a rutas relativas
 * correctas en función del tipo de contenido y la nueva estructura de carpetas.
 *
 * Nueva estructura:
 * ```
 * src/
 *   ├── components/
 *   │   ├── schemas/
 *   │   ├── requestBodies/
 *   │   ├── responses/
 *   │   └── ...
 *   ├── paths/
 *   │   ├── user.yaml
 *   │   └── pet.yaml
 *   └── main.yaml
 * ```
 *
 * Rutas relativas desde cada ubicación:
 * - Desde paths/     -> ../components/responses/  (subir 1, entrar a components/responses)
 * - Desde components/schemas/   -> ../responses/  (subir 1, entrar a responses - mismo nivel)
 * - Desde components/responses/ -> ../schemas/    (subir 1, entrar a schemas - mismo nivel)
 *
 * @param {object} content        Objeto con el contenido a corregir.
 * @param {string} componentType  Tipo ("schemas", "requestBodies", "paths", etc.).
 * @param {string} mainFileName   Nombre del archivo principal sin extensión.
 * @param {object} namingConfig   Configuración de nombres.
 * @param {object} affixesConfig  Configuración de prefijos/sufijos.
 * @param {boolean} extractResponses  Si las respuestas se extraen a archivos separados.
 * @returns {object}              Objeto con referencias corregidas.
 */
function fixRefs(content, componentType, mainFileName = 'openapi', namingConfig = {}, affixesConfig = {}, extractResponses = false) {
  if (!content || typeof content !== 'object') {
    return content;
  }

  if (!mainFileName || typeof mainFileName !== 'string') {
    console.warn('⚠️  mainFileName no válido, usando default "openapi"');
    mainFileName = 'openapi';
  }

  let contentString = JSON.stringify(content);

  /**
   * Sanitiza un string para nombres de componentes OpenAPI válidos
   */
  function sanitizeComponentName(text) {
    if (!text) return '';
    return text
      .trim()
      .replace(/[^a-zA-Z0-9._-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Genera el nombre de archivo aplicando sanitización, convenciones y afijos
   */
  function generateFileName(itemName, type) {
    let fileName = sanitizeComponentName(itemName);
    const convention = namingConfig.components || 'PascalCase';
    fileName = applyNamingConvention(fileName, convention);

    if (affixesConfig.enabled) {
      const prefix = affixesConfig.prefixes?.[type] || '';
      const suffix = affixesConfig.suffixes?.[type] || '';
      if (prefix) fileName = prefix + fileName;
      if (suffix) fileName = fileName + suffix;
    }
    return fileName;
  }

  /**
   * Calcula la ruta relativa correcta según el origen y destino
   * @param {string} fromType - Tipo de componente origen (paths, schemas, responses, etc.)
   * @param {string} toType - Tipo de componente destino
   * @returns {string} - Prefijo de ruta relativa
   */
  function getRelativePath(fromType, toType) {
    if (fromType === 'paths') {
      // Desde paths/ hacia components/*
      // paths/pet.yaml -> ../components/schemas/Pet.yaml
      return `../components/${toType}`;
    } else {
      // Desde components/* hacia components/*
      // components/schemas/Pet.yaml -> ../responses/Ok.yaml
      return `../${toType}`;
    }
  }

  if (componentType === 'schemas') {
    // Dentro de schemas: referencias a otros schemas
    contentString = contentString.replace(
      /"#\/components\/schemas\/([^"]+)"/g,
      (match, name) => {
        const fileName = generateFileName(name, 'schemas');
        const relativePath = getRelativePath('schemas', 'schemas');
        return `"${relativePath}/${fileName}.yaml"`;
      }
    );
  } else if (
    ['requestBodies', 'responses', 'securitySchemes', 'parameters', 'examples', 'headers'].includes(componentType)
  ) {
    // Referencias a schemas
    contentString = contentString.replace(
      /"#\/components\/schemas\/([^"]+)"/g,
      (match, name) => {
        const fileName = generateFileName(name, 'schemas');
        const relativePath = getRelativePath(componentType, 'schemas');
        return `"${relativePath}/${fileName}.yaml"`;
      }
    );

    // Referencias al mismo tipo de componente
    const reSameType = new RegExp(`"#\\/components\\/${componentType}\\/([^"]+)"`, 'g');
    contentString = contentString.replace(reSameType, (match, name) => {
      const fileName = componentType === 'responses' ? name : generateFileName(name, componentType);
      const relativePath = getRelativePath(componentType, componentType);
      return `"${relativePath}/${fileName}.yaml"`;
    });

    // Referencias a otros tipos de componentes
    contentString = contentString.replace(
      /"#\/components\/([a-zA-Z]+)\/([^"]+)"/g,
      (match, componentCategory, name) => {
        if (componentCategory === componentType) return match;
        const fileName = componentCategory === 'responses' ? name : generateFileName(name, componentCategory);
        const relativePath = getRelativePath(componentType, componentCategory);
        return `"${relativePath}/${fileName}.yaml"`;
      }
    );
  } else if (componentType === 'paths') {
    // Desde paths: referencias a componentes
    
    if (extractResponses) {
      // Si las respuestas están extraídas a archivos separados,
      // las referencias a responses van a ../components/responses/
      contentString = contentString.replace(
        /"#\/components\/responses\/([^"]+)"/g,
        (match, name) => {
          // El nombre ya viene procesado del extractor de respuestas
          return `"../components/responses/${name}.yaml"`;
        }
      );
    }

    // Referencias a schemas y otros componentes -> al archivo principal
    contentString = contentString.replace(
      /"#\/components\/schemas\/([^"]+)"/g,
      `"../${mainFileName}.yaml#/components/schemas/$1"`
    );

    // Referencias genéricas restantes -> al archivo principal
    contentString = contentString.replace(
      /"#\/components\/([^"]+)"/g,
      (match, rest) => {
        // Evitar doble procesamiento de responses si ya se procesaron
        if (extractResponses && rest.startsWith('responses/')) {
          return match; // Ya procesado arriba
        }
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