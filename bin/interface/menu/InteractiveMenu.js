// bin/interface/menu/InteractiveMenu.js

const chalk = require('chalk');

/**
 * Menú interactivo para CLI
 */
class InteractiveMenu {
  constructor(container, commandFactory) {
    this.container = container;
    this.commandFactory = commandFactory;
    this.prompter = container.getPrompter();
    this.logger = container.getLogger();
  }

  /**
   * Muestra el menú principal
   */
  async show() {
    console.clear();
    this.showHeader();

    const action = await this.prompter.number(
      'Selecciona una acción',
      1,
      1,
      5
    );

    if (action === 5) {
      this.showGoodbye();
      process.exit(0);
    }

    await this.executeAction(action);
    await this.pause();
    await this.show();
  }

  /**
   * Muestra header del menú
   */
  showHeader() {
    console.log('\n' + chalk.dim('-'.repeat(70)));
    console.log(chalk.bold.hex('#F58C34')('  OpenAPI Builder v1.0.1'));
    console.log(chalk.dim('-'.repeat(70)) + '\n');

    console.log(chalk.bold('Selecciona una acción:\n'));
    console.log(chalk.cyan('  1) Modularizar OpenAPI'));
    console.log(chalk.dim('     Divide la especificación en múltiples archivos\n'));
    console.log(chalk.cyan('  2) Consolidar OpenAPI'));
    console.log(chalk.dim('     Une todos los archivos en un Bundle\n'));
    console.log(chalk.cyan('  3) Generar Documentación'));
    console.log(chalk.dim('     Genera documentación Markdown\n'));
    console.log(chalk.cyan('  4) Exportar a Swagger 2.0'));
    console.log(chalk.dim('     Convierte OpenAPI 3.x a Swagger 2.0\n'));
    console.log(chalk.red('  5) Salir'));
    console.log(chalk.dim('     Cierra la aplicación\n'));
  }

  /**
   * Ejecuta acción seleccionada
   */
  async executeAction(action) {
    try {
      switch (action) {
        case 1:
          await this.actionModularize();
          break;
        case 2:
          await this.actionBundle();
          break;
        case 3:
          await this.actionDocs();
          break;
        case 4:
          await this.actionSwagger2();
          break;
      }
      this.logger.success('Operación completada exitosamente');
    } catch (error) {
      this.logger.error('Error en operación', error);
    }
  }

  async actionModularize() {
    const config = this.container.getConfig();
    const defaultInput = config.modularize?.paths?.input || './api/openapi.yaml';

    const inputPath = await this.prompter.text(
      'Ruta del archivo OpenAPI',
      defaultInput
    );

    const command = this.commandFactory.createModularizeCommand();
    
    // ✅ Marcar como interactivo
    await command(inputPath, { isInteractive: true });
  }

  async actionBundle() {
    const config = this.container.getConfig();
    const commandFactory = this.commandFactory;

    const mainFile = commandFactory.getMainFile(config) || './src/openapi.yaml';
    const inputPath = await this.prompter.text(
      'Archivo modular de entrada',
      mainFile
    );

    const defaultOutput = config.bundle?.paths?.bundleOutput || './dist/bundle.yaml';
    const outputPath = await this.prompter.text(
      'Archivo bundle de salida',
      defaultOutput
    );

    const command = commandFactory.createBundleCommand();
    await command({ input: inputPath, output: outputPath });
  }

  async actionDocs() {
    const config = this.container.getConfig();
    
    const defaultInput = config.bundle?.paths?.bundleOutput || './dist/bundle.yaml';
    const inputPath = await this.prompter.text(
      'Archivo OpenAPI de entrada',
      defaultInput
    );

    const defaultOutput = config.modularize?.paths?.docsOutput || './docs/api.md';
    const outputPath = await this.prompter.text(
      'Archivo Markdown de salida',
      defaultOutput
    );

    const command = this.commandFactory.createDocsCommand();
    await command({ input: inputPath, output: outputPath });
  }

  async actionSwagger2() {
    const config = this.container.getConfig();
    
    const defaultInput = config.swagger2?.paths?.input || 
                        config.bundle?.paths?.bundleOutput || 
                        './dist/bundle.yaml';
    const inputPath = await this.prompter.text(
      'Bundle OpenAPI 3.x de entrada',
      defaultInput
    );

    const defaultOutput = config.swagger2?.paths?.output || './dist/swagger2.yaml';
    const outputPath = await this.prompter.text(
      'Archivo Swagger 2.0 de salida',
      defaultOutput
    );

    const command = this.commandFactory.createSwagger2Command();
    await command({ input: inputPath, output: outputPath });
  }

  async pause() {
    await this.prompter.confirm('Presiona enter para continuar', true);
  }

  showGoodbye() {
    console.log('\n' + chalk.bold.hex('#F58C34')('👋 ¡Hasta luego!'));
    console.log(chalk.dim('-'.repeat(70)) + '\n');
  }
}

module.exports = { InteractiveMenu };