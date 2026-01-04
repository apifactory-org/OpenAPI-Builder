// bin/domain/services/PathPropertyReordererService.js

/**
 * @fileoverview Servicio de dominio para reordenar propiedades en operaciones OpenAPI.
 * 
 * Este servicio garantiza un orden consistente de propiedades en operaciones HTTP,
 * mejorando la legibilidad y mantenibilidad de los archivos YAML generados.
 * 
 * Orden estándar aplicado:
 * operationId → summary → description → tags → externalDocs → 
 * parameters → requestBody → responses → callbacks → 
 * deprecated → security → servers → extensiones (x-*)
 * 
 * @module domain/services/PathPropertyReordererService
 */

/**
 * Servicio para reordenar propiedades de operaciones OpenAPI.
 * 
 * Aplica un orden estándar consistente a todas las operaciones HTTP,
 * colocando primero las propiedades más importantes para la lectura.
 * 
 * @class PathPropertyReordererService
 * 
 * @example
 * const reorderer = new PathPropertyReordererService();
 * const reordered = reorderer.reorderPathFile(pathFile);
 */
class PathPropertyReordererService {
  /**
   * Orden preferido de propiedades en operaciones HTTP.
   * Las propiedades no listadas se colocan al final en su orden original.
   * 
   * @private
   * @static
   * @readonly
   */
  static OPERATION_PROPERTY_ORDER = [
    'operationId',      // Identificador único de la operación
    'summary',          // Resumen corto
    'description',      // Descripción detallada
    'tags',             // Categorización
    'externalDocs',     // Documentación externa
    'parameters',       // Parámetros de entrada
    'requestBody',      // Cuerpo de la solicitud
    'responses',        // Respuestas posibles
    'callbacks',        // Webhooks/callbacks
    'deprecated',       // Marcador de deprecación
    'security',         // Requisitos de seguridad
    'servers',          // Servidores específicos
    // Extensiones x-* se colocan automáticamente al final
  ];

  /**
   * Métodos HTTP válidos en OpenAPI.
   * 
   * @private
   * @static
   * @readonly
   */
  static HTTP_METHODS = new Set([
    'get', 'put', 'post', 'delete', 
    'options', 'head', 'patch', 'trace'
  ]);

  /**
   * Reordena las propiedades de un PathFile.
   * 
   * Procesa el contenido del PathFile y reordena todas las operaciones HTTP
   * que encuentre, manteniendo intactas otras propiedades como parámetros
   * a nivel de path, servers, etc.
   * 
   * @param {PathFile} pathFile - Archivo de path a reordenar
   * @returns {PathFile} Nuevo PathFile con propiedades reordenadas
   * 
   * @example
   * const pathFile = new PathFile('/pet/{id}', { ... });
   * const reordered = reorderer.reorderPathFile(pathFile);
   */
  reorderPathFile(pathFile) {
    const reorderedContent = this.reorderPathContent(pathFile.content);
    
    // Crear nuevo PathFile con contenido reordenado
    return new (pathFile.constructor)(pathFile.route, reorderedContent);
  }

  /**
   * Reordena el contenido de un objeto path.
   * 
   * Itera sobre todas las claves del path y reordena aquellas que
   * correspondan a métodos HTTP, dejando las demás intactas.
   * 
   * @param {Object} pathContent - Contenido del path
   * @returns {Object} Contenido con operaciones reordenadas
   * 
   * @example
   * const content = {
   *   parameters: [...],
   *   get: { tags: [...], operationId: '...' },
   *   post: { ... }
   * };
   * const reordered = reorderer.reorderPathContent(content);
   */
  reorderPathContent(pathContent) {
    const reordered = {};
    
    for (const [key, value] of Object.entries(pathContent)) {
      if (this.isHttpMethod(key)) {
        // Es una operación HTTP: reordenar sus propiedades
        reordered[key] = this.reorderObject(
          value, 
          PathPropertyReordererService.OPERATION_PROPERTY_ORDER
        );
      } else {
        // No es operación HTTP: mantener tal cual
        reordered[key] = value;
      }
    }
    
    return reordered;
  }

  /**
   * Reordena un objeto según un array de claves preferidas.
   * 
   * Las claves que aparecen en `preferredOrder` se colocan primero
   * en ese orden. Las claves restantes (incluyendo extensiones x-*)
   * se colocan después en su orden original.
   * 
   * @private
   * @param {Object} obj - Objeto a reordenar
   * @param {string[]} preferredOrder - Orden preferido de claves
   * @returns {Object} Objeto reordenado
   * 
   * @example
   * reorderObject(
   *   { responses: {}, tags: [], operationId: 'x' },
   *   ['operationId', 'tags', 'responses']
   * )
   * // Returns: { operationId: 'x', tags: [], responses: {} }
   */
  reorderObject(obj, preferredOrder) {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }
    
    const ordered = {};
    const processedKeys = new Set();
    
    // 1. Agregar claves según el orden preferido
    for (const key of preferredOrder) {
      if (key in obj) {
        ordered[key] = obj[key];
        processedKeys.add(key);
      }
    }
    
    // 2. Agregar claves restantes (incluyendo extensiones x-*)
    for (const key of Object.keys(obj)) {
      if (!processedKeys.has(key)) {
        ordered[key] = obj[key];
      }
    }
    
    return ordered;
  }

  /**
   * Verifica si una clave corresponde a un método HTTP.
   * 
   * @private
   * @param {string} key - Clave a verificar
   * @returns {boolean} true si es un método HTTP válido
   * 
   * @example
   * isHttpMethod('get')    // true
   * isHttpMethod('post')   // true
   * isHttpMethod('parameters') // false
   */
  isHttpMethod(key) {
    return PathPropertyReordererService.HTTP_METHODS.has(
      key.toLowerCase()
    );
  }

  /**
   * Reordena múltiples PathFiles.
   * 
   * Método de conveniencia para procesar un array de PathFiles.
   * 
   * @param {PathFile[]} pathFiles - Array de PathFiles
   * @returns {PathFile[]} Array de PathFiles reordenados
   * 
   * @example
   * const pathFiles = [pathFile1, pathFile2, pathFile3];
   * const reordered = reorderer.reorderPathFiles(pathFiles);
   */
  reorderPathFiles(pathFiles) {
    return pathFiles.map(pf => this.reorderPathFile(pf));
  }
}

module.exports = { PathPropertyReordererService };