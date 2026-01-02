#!/usr/bin/env node
// bin/interface/cli/cli.js

const { program } = require('commander');
const chalk = require('chalk');
const { DependencyContainer } = require('./DependencyContainer');
const { CommandFactory } = require('./CommandFactory');

// Inicializar contenedor
const container = new DependencyContainer();
container.initialize();

// Factory de comandos
const commandFactory = new CommandFactory(container);
const config = container.getConfig();

// ===============================================
// CLI CONFIGURATION
// ===============================================

program
  .name('openapi-builder')
  .description('Utilidades para OpenAPI 3.x: modularizar, bundle, docs y Swagger 2.0')
  .version('2.0.0');

// ===============================================
// COMMAND: modularize
// ===============================================

program
  .command('modularize')
  .description('Descompone un OpenAPI monolítico en estructura modular')
  .requiredOption('--build <file>', 'Archivo OpenAPI de entrada')
  .action(async (options) => {
    try {
      console.log(chalk.blue('\n🚀 Ejecutando: modularize\n'));
      const command = commandFactory.createModularizeCommand();
      await command(options.build);
      console.log(chalk.green('\n✅ Comando completado\n'));
    } catch (error) {
      console.error(chalk.red('\n✖ Error:'), error.message);
      process.exit(1);
    }
  });

// ===============================================
// COMMAND: bundle
// ===============================================

program
  .command('bundle')
  .description('Genera bundle único desde estructura modular')
  .option('-i, --input <file>', 'Archivo modular de entrada')
  .option('-o, --output <file>', 'Archivo bundle de salida')
  .action(async (options) => {
    try {
      console.log(chalk.blue('\n📦 Ejecutando: bundle\n'));
      const command = commandFactory.createBundleCommand();
      await command(options);
      console.log(chalk.green('\n✅ Comando completado\n'));
    } catch (error) {
      console.error(chalk.red('\n✖ Error:'), error.message);
      process.exit(1);
    }
  });

// ===============================================
// COMMAND: docs
// ===============================================

program
  .command('docs')
  .description('Genera documentación Markdown desde OpenAPI')
  .option('-i, --input <file>', 'Archivo OpenAPI de entrada')
  .option('-o, --output <file>', 'Archivo Markdown de salida')
  .action(async (options) => {
    try {
      console.log(chalk.blue('\n📚 Ejecutando: docs\n'));
      const command = commandFactory.createDocsCommand();
      await command(options);
      console.log(chalk.green('\n✅ Comando completado\n'));
    } catch (error) {
      console.error(chalk.red('\n✖ Error:'), error.message);
      process.exit(1);
    }
  });

// ===============================================
// COMMAND: swagger2
// ===============================================

program
  .command('swagger2')
  .description('Convierte OpenAPI 3.x a Swagger 2.0')
  .option('-i, --input <file>', 'Bundle OpenAPI 3.x de entrada')
  .option('-o, --output <file>', 'Archivo Swagger 2.0 de salida')
  .action(async (options) => {
    try {
      console.log(chalk.blue('\n⬇️  Ejecutando: swagger2\n'));
      const command = commandFactory.createSwagger2Command();
      await command(options);
      console.log(chalk.green('\n✅ Comando completado\n'));
    } catch (error) {
      console.error(chalk.red('\n✖ Error:'), error.message);
      process.exit(1);
    }
  });

// ===============================================
// INTERACTIVE MENU (if no arguments)
// ===============================================

if (process.argv.length <= 2) {
  const { InteractiveMenu } = require('../menu/InteractiveMenu');
  const menu = new InteractiveMenu(container, commandFactory);
  
  menu.show().catch(error => {
    console.error(chalk.red('\n✖ Error en menú:'), error.message);
    process.exit(1);
  });
} else {
  program.parse(process.argv);
}