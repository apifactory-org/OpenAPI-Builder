// bin/core/fixRefs.js

/**
 * Corrige los $ref dentro de un objeto OpenAPI, transformándolos a rutas relativas
 * correctas en función del tipo de contenido (schemas, requestBodies, paths, etc).
 *
 * Estrategia:
 * - `schemas`:
 *    "#/components/schemas/Foo" -> "#/Foo"
 * - otros componentes (requestBodies, responses, parameters, ...):
 *    "#/components/schemas/Foo"       -> "./schemas.yaml#/Foo"
 *    "#/components/<tipo>/Bar"        -> "./<tipo>.yaml#/Bar"
 * - `paths`:
 *    "#/components/<algo>/X" -> "../openapi.yaml#/components/<algo>/X"
 *
 * @param {object} content       Objeto con el contenido a corregir.
 * @param {string} componentType Tipo ("schemas", "requestBodies", "paths", etc.).
 * @returns {object}             Objeto con referencias corregidas.
 */
function fixRefs(content, componentType) {
  if (!content || typeof content !== 'object') {
    return content;
  }

  let contentString = JSON.stringify(content);

  if (componentType === 'schemas') {
    // Ej.: "#/components/schemas/Category" -> "#/Category"
    contentString = contentString.replace(
      /"#\/components\/schemas\/([^"]+)"/g,
      (match, name) => `"#/${name}"`,
    );
  } else if (
    ['requestBodies', 'responses', 'securitySchemes', 'parameters', 'examples', 'headers'].includes(
      componentType,
    )
  ) {
    // Refs a schemas → archivo schemas.yaml
    contentString = contentString.replace(
      /"#\/components\/schemas\/([^"]+)"/g,
      (match, name) => `"./schemas.yaml#/${name}"`,
    );

    // Refs al mismo tipo de componente → ./<tipo>.yaml#/Nombre
    const reSameType = new RegExp(`"#\\/components\\/${componentType}\\/([^"]+)"`, 'g');
    contentString = contentString.replace(reSameType, (match, name) => {
      return `"./${componentType}.yaml#/${name}"`;
    });
  } else if (componentType === 'paths') {
    // Desde paths: apuntar de nuevo al openapi.yaml principal
    // "#/components/parameters/AuthorizationHeader"
    contentString = contentString.replace(
      /"#\/components\/([^"]+)"/g,
      `"../openapi.yaml#/components/$1"`,
    );
  }

  return JSON.parse(contentString);
}

module.exports = { fixRefs };
