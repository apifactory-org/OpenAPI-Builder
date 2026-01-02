// bin/infrastructure/adapters/YamlDocumentRepository.js

const fs = require('fs');
const yaml = require('js-yaml');
const { IDocumentRepository } = require('../../application/ports/IDocumentRepository');
const { OpenAPIDocument } = require('../../domain/entities/OpenAPIDocument');

/**
 * Adapter: Repositorio de documentos usando YAML
 */
class YamlDocumentRepository extends IDocumentRepository {
  constructor(logger) {
    super();
    this.logger = logger;
  }

  async read(filePath) {
    try {
      const content = fs.readFileSync(filePath.toString(), 'utf8');
      const data = yaml.load(content);
      return new OpenAPIDocument(data);
    } catch (error) {
      throw new Error(`Error leyendo documento: ${error.message}`);
    }
  }

  async write(filePath, document) {
    return this.writeYaml(filePath, document.toJSON());
  }

  async writeYaml(filePath, content) {
    try {
      const dir = filePath.getDirectory();
      await this.ensureDirectory(dir);

      const yamlText = yaml.dump(content, {
        indent: 2,
        noRefs: true,
        noCompatMode: true,
        lineWidth: -1
      });

      fs.writeFileSync(filePath.toString(), yamlText, 'utf8');
      this.logger.debug(`Archivo escrito: ${filePath}`);
    } catch (error) {
      throw new Error(`Error escribiendo archivo: ${error.message}`);
    }
  }

  /**
   * Escribe YAML con comentario de header
   */
  async writeYamlWithHeader(filePath, content, headerComment) {
    try {
      const dir = filePath.getDirectory();
      await this.ensureDirectory(dir);

      let yamlText = yaml.dump(content, {
        indent: 2,
        noRefs: true,
        noCompatMode: true,
        lineWidth: -1
      });

      // Agregar header comment al inicio
      if (headerComment) {
        const commentLines = headerComment
          .split('\n')
          .map(line => `# ${line}`)
          .join('\n');
        yamlText = `${commentLines}\n\n${yamlText}`;
      }

      fs.writeFileSync(filePath.toString(), yamlText, 'utf8');
      this.logger.debug(`Archivo escrito con header: ${filePath}`);
    } catch (error) {
      throw new Error(`Error escribiendo archivo: ${error.message}`);
    }
  }

  async exists(filePath) {
    return fs.existsSync(filePath.toString());
  }

  async directoryExists(dirPath) {
    return fs.existsSync(dirPath.toString());
  }

  async removeDirectory(dirPath) {
    if (fs.existsSync(dirPath.toString())) {
      this.logger.debug(`Eliminando directorio: ${dirPath}`);
      fs.rmSync(dirPath.toString(), { recursive: true, force: true });
    }
  }

  async ensureDirectory(dirPath) {
    if (!fs.existsSync(dirPath.toString())) {
      this.logger.debug(`Creando directorio: ${dirPath}`);
      fs.mkdirSync(dirPath.toString(), { recursive: true });
    }
  }
}

module.exports = { YamlDocumentRepository };