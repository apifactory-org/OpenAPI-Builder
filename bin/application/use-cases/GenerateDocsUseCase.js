// bin/application/use-cases/GenerateDocsUseCase.js

const { FilePath } = require('../../domain/value-objects/FilePath');

/**
 * Use Case: Generar documentación Markdown desde OpenAPI
 */
class GenerateDocsUseCase {
  constructor(documentRepository, docGenerator, logger) {
    this.documentRepo = documentRepository;
    this.docGenerator = docGenerator;
    this.logger = logger;
  }

  /**
   * Ejecuta el caso de uso
   */
  async execute(inputPath, outputPath, options = {}) {
    this.logger.section('GENERANDO DOCUMENTACIÓN');

    try {
      // 1. Validar input
      const inputFilePath = new FilePath(inputPath);
      
      if (!await this.documentRepo.exists(inputFilePath)) {
        throw new Error(`Archivo de entrada no encontrado: ${inputPath}`);
      }

      this.logger.info(`Entrada: ${inputPath}`);

      // 2. Preparar output
      const outputFilePath = new FilePath(outputPath);
      const outputDir = outputFilePath.getDirectory();
      
      await this.documentRepo.ensureDirectory(outputDir);
      this.logger.info(`Salida: ${outputPath}`);

      // 3. Generar documentación
      this.logger.step('Generando documentación Markdown...');
      await this.docGenerator.generate(inputFilePath, outputFilePath, options);

      this.logger.section('✓ DOCUMENTACIÓN COMPLETADA');
      this.logger.success(`Documentación generada en: ${outputPath}`);

    } catch (error) {
      this.logger.section('✗ ERROR EN DOCUMENTACIÓN');
      this.logger.error('Error al generar documentación', error);
      throw error;
    }
  }
}

module.exports = { GenerateDocsUseCase };