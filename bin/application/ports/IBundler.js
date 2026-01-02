// bin/application/ports/IBundler.js

/**
 * Port: Bundler de documentos OpenAPI
 * Define contrato para consolidación de documentos modulares
 */
class IBundler {
  /**
   * Genera un bundle desde un documento modular
   * @param {FilePath} inputPath - Ruta del entrypoint modular
   * @param {FilePath} outputPath - Ruta del bundle de salida
   * @param {Object} options - Opciones de bundling
   * @returns {Promise<void>}
   */
  async bundle(inputPath, outputPath, options = {}) {
    throw new Error('Not implemented');
  }
}

module.exports = { IBundler };