// bin/infrastructure/adapters/RedoclyBundler.js

const { IBundler } = require('../../application/ports/IBundler');

/**
 * Adapter: Bundler usando Redocly CLI
 */
class RedoclyBundler extends IBundler {
  constructor(executableResolver, commandRunner, documentRepository, logger) {
    super();
    this.executableResolver = executableResolver;
    this.commandRunner = commandRunner;
    this.documentRepo = documentRepository;
    this.logger = logger;
  }

  async bundle(inputPath, outputPath, options = {}) {
    const redoclyPath = this.executableResolver.resolve('redocly');
    
    if (!redoclyPath) {
      throw new Error(
        'No se encontró Redocly CLI en node_modules/.bin. ' +
        'Instala @redocly/cli como dependencia.'
      );
    }

    // PASO 1: Bundle básico
    await this.executeBundleStep1(redoclyPath, inputPath, outputPath, options);

    // PASO 2: Remove unused components (si está habilitado)
    if (options.removeUnusedComponents) {
      await this.executeBundleStep2(redoclyPath, outputPath, options);
    }

    // PASO 3: Reescribir sin anchors YAML (si no está dereferenciado)
    if (!options.dereference) {
      await this.rewriteWithoutAnchors(outputPath);
    }
  }

  async executeBundleStep1(redoclyPath, inputPath, outputPath, options) {
    this.logger.info('Paso 1: Generando bundle...');
    
    const flags = [];
    
    if (options.dereference) {
      flags.push('--dereferenced');
    }
    
    if (options.injectFormat) {
      flags.push('--inject-format');
    }
    
    // ✅ FIX: NO usar --skip-rule (deprecado en Redocly 1.19.0+)
    // En su lugar, usar --lint-config=off para desactivar linting
    if (!options.validate) {
      flags.push('--lint-config=off');
    }

    const command = [
      `"${redoclyPath}"`,
      'bundle',
      `"${inputPath}"`,
      '-o',
      `"${outputPath}"`,
      ...flags
    ].join(' ');

    const { stdout } = await this.commandRunner.run(command);
    
    if (stdout && stdout.trim()) {
      this.logger.debug(stdout);
    }
  }

  async executeBundleStep2(redoclyPath, outputPath, options) {
    this.logger.info('Paso 2: Eliminando componentes no usados...');
    
    const flags = ['--remove-unused-components'];
    
    // ✅ FIX: Usar --lint-config=off en vez de --skip-rule
    if (!options.validate) {
      flags.push('--lint-config=off');
    }

    const command = [
      `"${redoclyPath}"`,
      'bundle',
      `"${outputPath}"`,
      '-o',
      `"${outputPath}"`,
      ...flags
    ].join(' ');

    const { stdout } = await this.commandRunner.run(command);
    
    if (stdout && stdout.trim()) {
      this.logger.debug(stdout);
    }
  }

  async rewriteWithoutAnchors(outputPath) {
    try {
      this.logger.info('Paso 3: Reescribiendo sin anchors YAML...');
      
      const fs = require('fs');
      const yaml = require('js-yaml');
      
      const content = fs.readFileSync(outputPath.toString(), 'utf8');
      const data = yaml.load(content);
      
      const yamlText = yaml.dump(data, {
        indent: 2,
        noRefs: true,
        noCompatMode: true,
        lineWidth: -1
      });
      
      fs.writeFileSync(outputPath.toString(), yamlText, 'utf8');
      this.logger.debug('Bundle reescrito sin anchors YAML');
    } catch (error) {
      this.logger.warn(`No se pudo reescribir sin anchors: ${error.message}`);
    }
  }
}

module.exports = { RedoclyBundler };