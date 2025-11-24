// bin/application/validate.js

const chalk = require('chalk');
const { resolveExecutable } = require('../infrastructure/executables');
const { runCommand } = require('../infrastructure/runCommand');

/**
 * Ejecuta `redocly lint` sobre un archivo OpenAPI dado.
 *
 * @param {string} filePath - Ruta al archivo OAS principal a validar.
 */
async function validateWithRedocly(filePath) {
  console.log(chalk.cyan('\n🔍 Validando con Redocly (lint)...'));

  const redoclyPath = resolveExecutable('redocly');

  if (!redoclyPath) {
    console.error(
      chalk.red(
        '\n✖ No se encontró el ejecutable de Redocly CLI en node_modules/.bin del paquete @apifactory/oas3-modularize.',
      ),
    );
    console.error(
      chalk.red(
        'Asegúrate de que @redocly/cli esté instalado como dependencia del paquete (ya viene en package.json).',
      ),
    );
    process.exit(1);
  }

  const command = `"${redoclyPath}" lint "${filePath}"`;

  try {
    const { stdout } = await runCommand(command);

    if (stdout.includes('validates successfully') || stdout.includes('No problems found!')) {
      console.log(chalk.green('✔ La estructura modular fue validada exitosamente por Redocly.'));
      if (!stdout.includes('No problems found!')) {
        const warnings = stdout
          .split('\n')
          .filter((line) => line.toLowerCase().includes('warning'));
        if (warnings.length > 0) {
          console.log(chalk.yellow('\n⚠ Advertencias de Redocly:'));
          warnings.forEach((w) => console.log(chalk.yellow('  • ' + w.trim())));
        }
      }
    } else {
      console.log(stdout);
    }
  } catch (error) {
    const report = error.stdout || error.message || '';
    console.error(chalk.red('\n✖ Error crítico de validación en Redocly:\n'));
    console.error(report.trim());
    console.error(
      chalk.red(
        `\nEl archivo modularizado ${filePath} NO es válido según Redocly. Corrige los errores y vuelve a intentarlo.`,
      ),
    );
    process.exit(1);
  }
}

module.exports = {
  validateWithRedocly,
};
