// bin/infrastructure/adapters/ApiSpecConverterDowngrader.js

/**
 * Adapter: Downgrade a Swagger 2.0 usando api-spec-converter
 */
class ApiSpecConverterDowngrader {
  constructor(executableResolver, commandRunner, logger) {
    this.executableResolver = executableResolver;
    this.commandRunner = commandRunner;
    this.logger = logger;
  }

  async downgrade(inputPath, outputPath, options = {}) {
    const converterPath = this.executableResolver.resolve('api-spec-converter');
    
    if (!converterPath) {
      throw new Error(
        'No se encontró api-spec-converter en node_modules/.bin. ' +
        'Instala api-spec-converter como dependencia.'
      );
    }

    const command = [
      `"${converterPath}"`,
      '--from=openapi_3',
      '--to=swagger_2',
      '--syntax=yaml',
      `"${inputPath}"`,
      '>',
      `"${outputPath}"`
    ].join(' ');

    try {
      await this.commandRunner.run(command);
      this.logger.success('Conversión a Swagger 2.0 completada');
    } catch (error) {
      const message = error.stdout || error.message || 'Error desconocido';
      throw new Error(`Error en conversión: ${message}`);
    }
  }
}

module.exports = { ApiSpecConverterDowngrader };