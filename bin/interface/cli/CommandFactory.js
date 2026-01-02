// bin/interface/cli/CommandFactory.js

const path = require('path');

/**
 * Factory: Crea comandos con dependencias inyectadas
 */
class CommandFactory {
  constructor(container) {
    this.container = container;
  }

  /**
   * Crea comando modularize
   */
  createModularizeCommand() {
    return async (inputPath, options = {}) => {
      const config = this.container.getConfig();
      const useCase = this.container.getModularizeUseCase();

      // Resolver input
      const finalInput = inputPath || config.modularize?.paths?.input;
      
      if (!finalInput) {
        throw new Error(
          'Debes especificar el archivo de entrada:\n' +
          '  - vía CLI: openapi-builder modularize --build ./api/openapi.yaml\n' +
          '  - o en config/modularize.yaml → paths.input'
        );
      }

      // ✅ Detectar si es interactivo
      const isInteractive = options.isInteractive ?? false;

      await useCase.execute(finalInput, config.modularize, {
        isInteractive
      });
    };
  }

  /**
   * Crea comando bundle
   */
  createBundleCommand() {
    return async (options) => {
      const config = this.container.getConfig();
      const useCase = this.container.getBundleUseCase();

      // Resolver input
      const input = this.resolveInput(options.input, config);
      
      // Resolver output
      const output = options.output || config.bundle?.paths?.bundleOutput;
      
      if (!output) {
        throw new Error(
          'Debes especificar el archivo de salida:\n' +
          '  - vía CLI: openapi-builder bundle -o ./dist/bundle.yaml\n' +
          '  - o en config/bundle.yaml → paths.bundleOutput'
        );
      }

      await useCase.execute(input, output, config.bundle || {});
    };
  }

  /**
   * Crea comando docs
   */
  createDocsCommand() {
    return async (options) => {
      const config = this.container.getConfig();
      const useCase = this.container.getGenerateDocsUseCase();

      // Resolver input
      const input = options.input || 
                    config.bundle?.paths?.bundleOutput ||
                    this.getMainFile(config);
      
      if (!input) {
        throw new Error(
          'Debes especificar el archivo de entrada:\n' +
          '  - vía CLI: openapi-builder docs -i ./dist/bundle.yaml\n' +
          '  - o en config/bundle.yaml → paths.bundleOutput'
        );
      }

      // Resolver output
      const output = options.output || config.modularize?.paths?.docsOutput;
      
      if (!output) {
        throw new Error(
          'Debes especificar el archivo de salida:\n' +
          '  - vía CLI: openapi-builder docs -o ./docs/api.md\n' +
          '  - o en config/modularize.yaml → paths.docsOutput'
        );
      }

      await useCase.execute(input, output);
    };
  }

  /**
   * Crea comando swagger2
   */
  createSwagger2Command() {
    return async (options) => {
      const config = this.container.getConfig();
      const useCase = this.container.getDowngradeSwagger2UseCase();

      // Resolver input
      const input = options.input || 
                    config.swagger2?.paths?.input ||
                    config.bundle?.paths?.bundleOutput;
      
      if (!input) {
        throw new Error(
          'Debes especificar el archivo de entrada:\n' +
          '  - vía CLI: openapi-builder swagger2 -i ./dist/bundle.yaml\n' +
          '  - o en config/swagger2.yaml → paths.input'
        );
      }

      // Resolver output
      const output = options.output || config.swagger2?.paths?.output;

      await useCase.execute(input, output);
    };
  }

  /**
   * Resuelve input con prioridades
   */
  resolveInput(cliInput, config) {
    if (cliInput) return cliInput;

    // Intentar obtener MAIN_FILE
    const mainFile = this.getMainFile(config);
    if (mainFile) return mainFile;

    throw new Error(
      'No se pudo determinar el archivo de entrada:\n' +
      '  - Pasa --input explícitamente\n' +
      '  - O configura config/modularize.yaml correctamente'
    );
  }

  /**
   * Obtiene MAIN_FILE desde config
   */
  getMainFile(config) {
    if (!config.modularize) return null;

    const modConfig = config.modularize;
    const outputDir = modConfig.paths?.modularizedOutput;
    const mainFileName = modConfig.paths?.mainFileName || 'openapi';
    const extension = modConfig.advanced?.fileExtension || '.yaml';

    if (!outputDir) return null;

    return path.join(outputDir, mainFileName + extension);
  }
}

module.exports = { CommandFactory };