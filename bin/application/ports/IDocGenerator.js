// bin/application/ports/IDocGenerator.js

/**
 * Port: Generador de documentación
 * Define contrato para generación de documentación desde OpenAPI
 */
class IDocGenerator {
  /**
   * Genera documentación desde un documento OpenAPI
   * @param {FilePath} inputPath - Ruta del documento OpenAPI
   * @param {FilePath} outputPath - Ruta de salida de la documentación
   * @param {Object} options - Opciones de generación
   * @returns {Promise<void>}
   */
  async generate(inputPath, outputPath, options = {}) {
    throw new Error('Not implemented');
  }
}

module.exports = { IDocGenerator };