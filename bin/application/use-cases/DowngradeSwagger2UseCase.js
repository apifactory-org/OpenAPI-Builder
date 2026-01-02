// bin/application/use-cases/DowngradeSwagger2UseCase.js

const { FilePath } = require('../../domain/value-objects/FilePath');
const path = require('path');

/**
 * Use Case: Convertir OpenAPI 3.x a Swagger 2.0
 */
class DowngradeSwagger2UseCase {
  constructor(documentRepository, downgrader, logger) {
    this.documentRepo = documentRepository;
    this.downgrader = downgrader;
    this.logger = logger;
  }

  /**
   * Ejecuta el caso de uso
   */
  async execute(inputPath, outputPath, options = {}) {
    this.logger.section('CONVIRTIENDO A SWAGGER 2.0');

    try {
      // 1. Validar input
      const inputFilePath = new FilePath(inputPath);
      
      if (!await this.documentRepo.exists(inputFilePath)) {
        throw new Error(`Archivo de entrada no encontrado: ${inputPath}`);
      }

      this.logger.info(`Entrada: ${inputPath}`);

      // 2. Resolver output si no se especificó
      let outputFilePath;
      if (outputPath) {
        outputFilePath = new FilePath(outputPath);
      } else {
        outputFilePath = this.buildDefaultOutputPath(inputFilePath);
      }

      // 3. Preparar directorio de salida
      const outputDir = outputFilePath.getDirectory();
      await this.documentRepo.ensureDirectory(outputDir);
      this.logger.info(`Salida: ${outputFilePath}`);

      // 4. Ejecutar conversión
      this.logger.step('Convirtiendo OpenAPI 3.x → Swagger 2.0...');
      await this.downgrader.downgrade(inputFilePath, outputFilePath, options);

      this.logger.section('✓ CONVERSIÓN COMPLETADA');
      this.logger.success(`Swagger 2.0 generado en: ${outputFilePath}`);

    } catch (error) {
      this.logger.section('✗ ERROR EN CONVERSIÓN');
      this.logger.error('Error al convertir a Swagger 2.0', error);
      throw error;
    }
  }

  /**
   * Construye ruta de salida por defecto
   */
  buildDefaultOutputPath(inputFilePath) {
    const dir = inputFilePath.getDirectory();
    const basename = path.basename(
      inputFilePath.toString(),
      inputFilePath.getExtension()
    );
    return dir.join(`${basename}.swagger2.yaml`);
  }
}

module.exports = { DowngradeSwagger2UseCase };