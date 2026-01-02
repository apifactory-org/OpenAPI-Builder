// bin/application/use-cases/BundleUseCase.js

const { FilePath } = require('../../domain/value-objects/FilePath');

/**
 * Use Case: Generar bundle desde estructura modular
 */
class BundleUseCase {
  constructor(documentRepository, bundler, logger) {
    this.documentRepo = documentRepository;
    this.bundler = bundler;
    this.logger = logger;
  }

  /**
   * Ejecuta el caso de uso
   */
  async execute(inputPath, outputPath, config) {
    this.logger.section('GENERANDO BUNDLE');

    try {
      // 1. Validar input
      const inputFilePath = new FilePath(inputPath);
      
      if (!await this.documentRepo.exists(inputFilePath)) {
        throw new Error(`Archivo de entrada no encontrado: ${inputPath}`);
      }

      this.logger.info(`Entrada: ${inputPath}`);

      // 2. Validar/preparar output
      const outputFilePath = new FilePath(outputPath);
      const outputDir = outputFilePath.getDirectory();

      // Limpiar carpeta dist si está configurado
      if (config.behavior.cleanDist) {
        this.logger.step('Limpiando carpeta de salida...');
        await this.documentRepo.removeDirectory(outputDir);
      }

      await this.documentRepo.ensureDirectory(outputDir);
      this.logger.info(`Salida: ${outputPath}`);

      // 3. Ejecutar bundle
      const bundleOptions = {
        dereference: config.bundle.dereference,
        removeUnusedComponents: config.bundle.removeUnusedComponents,
        injectFormat: config.bundle.injectFormat,
        validate: config.bundle.validate
      };

      this.logger.step('Consolidando archivos modulares...');
      await this.bundler.bundle(inputFilePath, outputFilePath, bundleOptions);

      this.logger.section('✓ BUNDLE COMPLETADO');
      this.logger.success(`Bundle generado en: ${outputPath}`);

    } catch (error) {
      this.logger.section('✗ ERROR EN BUNDLE');
      this.logger.error('Error al generar bundle', error);
      throw error;
    }
  }

  /**
   * Resuelve ruta de entrada con prioridades
   */
  resolveInputPath(cliInput, config) {
    // Prioridad 1: CLI
    if (cliInput) return cliInput;

    // Prioridad 2: Config modularize (MAIN_FILE)
    if (config.modularize && config.modularize.mainFile) {
      return config.modularize.mainFile;
    }

    throw new Error(
      'No se pudo determinar el archivo de entrada. ' +
      'Pasa --input explícitamente o configura modularize.mainFile'
    );
  }

  /**
   * Resuelve ruta de salida con prioridades
   */
  resolveOutputPath(cliOutput, config) {
    // Prioridad 1: CLI
    if (cliOutput) return cliOutput;

    // Prioridad 2: Config bundle
    if (config.bundle && config.bundle.paths && config.bundle.paths.bundleOutput) {
      return config.bundle.paths.bundleOutput;
    }

    throw new Error(
      'No se pudo determinar el archivo de salida. ' +
      'Pasa --output explícitamente o configura bundle.paths.bundleOutput'
    );
  }
}

module.exports = { BundleUseCase };