// bin/application/ports/IDocumentRepository.js

/**
 * Port: Repositorio de documentos OpenAPI
 * Define contrato para persistencia de documentos
 */
class IDocumentRepository {
  /**
   * Lee un documento OpenAPI desde un archivo
   * @param {FilePath} filePath - Ruta del archivo
   * @returns {Promise<OpenAPIDocument>}
   */
  async read(filePath) {
    throw new Error('Not implemented');
  }

  /**
   * Escribe un documento OpenAPI en un archivo
   * @param {FilePath} filePath - Ruta del archivo
   * @param {OpenAPIDocument} document - Documento a escribir
   * @returns {Promise<void>}
   */
  async write(filePath, document) {
    throw new Error('Not implemented');
  }

  /**
   * Escribe un objeto genérico en YAML
   * @param {FilePath} filePath - Ruta del archivo
   * @param {Object} content - Contenido a escribir
   * @returns {Promise<void>}
   */
  async writeYaml(filePath, content) {
    throw new Error('Not implemented');
  }

  /**
   * Verifica si un archivo existe
   * @param {FilePath} filePath - Ruta del archivo
   * @returns {Promise<boolean>}
   */
  async exists(filePath) {
    throw new Error('Not implemented');
  }

  /**
   * Elimina un directorio recursivamente
   * @param {FilePath} dirPath - Ruta del directorio
   * @returns {Promise<void>}
   */
  async removeDirectory(dirPath) {
    throw new Error('Not implemented');
  }

  /**
   * Crea un directorio (y padres si no existen)
   * @param {FilePath} dirPath - Ruta del directorio
   * @returns {Promise<void>}
   */
  async ensureDirectory(dirPath) {
    throw new Error('Not implemented');
  }
}

module.exports = { IDocumentRepository };