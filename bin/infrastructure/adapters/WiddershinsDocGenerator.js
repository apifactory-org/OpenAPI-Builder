// bin/infrastructure/adapters/WiddershinsDocGenerator.js

const { IDocGenerator } = require('../../application/ports/IDocGenerator');

/**
 * Adapter: Generador de documentación usando Widdershins
 */
class WiddershinsDocGenerator extends IDocGenerator {
  constructor(executableResolver, commandRunner, logger) {
    super();
    this.executableResolver = executableResolver;
    this.commandRunner = commandRunner;
    this.logger = logger;
  }

  async generate(inputPath, outputPath, options = {}) {
    const widdershinsPath = this.executableResolver.resolve('widdershins');
    
    if (!widdershinsPath) {
      throw new Error(
        'No se encontró Widdershins en node_modules/.bin. ' +
        'Instala widdershins como dependencia.'
      );
    }

    const command = [
      `"${widdershinsPath}"`,
      `"${inputPath}"`,
      '-o',
      `"${outputPath}"`
    ].join(' ');

    await this.commandRunner.run(command);
    this.logger.success('Documentación Markdown generada');
  }
}

module.exports = { WiddershinsDocGenerator };