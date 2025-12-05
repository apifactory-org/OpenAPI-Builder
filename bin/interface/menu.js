// bin/interface/menu.js

/**
 * =============================================================================
 * MENU.JS — Interfaz de menú interactivo para OpenAPI Builder
 * =============================================================================
 *
 * PROPÓSITO:
 * ----------
 * Proporciona una interfaz de usuario interactiva basada en terminal para
 * ejecutar las diferentes operaciones del OpenAPI Builder.
 *
 * ACCIONES DISPONIBLES:
 * ---------------------
 *   1. Modularizar OAS3.x    → Divide especificación en múltiples archivos
 *   2. Consolidar OAS3.x     → Une archivos modulares en un bundle
 *   3. Generar Documentación → Crea documentación Markdown
 *   4. Exportar Swagger 2.0  → Convierte OAS3.x a Swagger 2.0
 *
 * USO:
 * ----
 *   const { startApplication } = require('./interface/menu');
 *   startApplication();
 *
 * =============================================================================
 */

const prompts = require('prompts');
const chalk = require('chalk');

// --- Importaciones de Infraestructura ---
const { loadAllConfigs } = require('../infrastructure/configLoader');
const { getVersionDisplay } = require('../infrastructure/version');

// --- Importaciones de Aplicación ---
const { createModularizer } = require('../application/modularize');
const { createBundleGenerator } = require('../application/bundle');
const { generateMarkdownDocs } = require('../application/docs');
const {
  downgradeToSwagger2,
  buildDefaultSwagger2Output,
} = require('../application/downgradeSwagger2');

// ---------------------------------------------------------------
// Carga de Configuración
// ---------------------------------------------------------------
const configs = loadAllConfigs();

const C = {
  modularizeInput: configs.modularize?.paths?.input,
  modularizeOutput: configs.modularize?.paths?.output,
  mainFileName: configs.modularize?.paths?.mainFileName || 'openapi',
  fileExtension: configs.modularize?.advanced?.fileExtension || '.yaml',
  bundleOutput: configs.bundle?.paths?.bundleOutput,
  docsOutput: configs.docs?.paths?.output,
  swagger2Input: configs.swagger2?.paths?.input,
  swagger2Output: configs.swagger2?.paths?.output,
};

// Construir ruta del main file
const MAIN_FILE = C.modularizeOutput 
  ? `${C.modularizeOutput}/${C.mainFileName}${C.fileExtension}`
  : './src/main.yaml';

// ---------------------------------------------------------------
// ESTILOS Y COLORES
// ---------------------------------------------------------------

const styles = {
  header: (text) => chalk.bold.hex('#F58C34')(text),
  success: (text) => chalk.green('✅ ' + text),
  error: (text) => chalk.red('❌ ' + text),
  info: (text) => chalk.cyan('ℹ️  ' + text),
  warn: (text) => chalk.yellow('⚠️  ' + text),
  help: (text) => chalk.dim.italic(text),
  divider: () => chalk.dim('─'.repeat(70)),
  section: (text) => chalk.bold.cyan(text),
  prompt: (text) => chalk.cyan(`  ${text}`),
};

// Configurar prompts con estilos limpios
const promptsConfig = {
  onState: (state) => {
    // Suprimir comportamiento por defecto de prompts
  },
};

/**
 * Imprime un resultado
 */
function printResult(message, type = 'success') {
  const styleMap = {
    success: styles.success,
    error: styles.error,
    info: styles.info,
    warn: styles.warn,
  };
  console.log('\n' + (styleMap[type] || styles.info)(message) + '\n');
}

/**
 * Pausa la ejecución
 */
async function pause() {
  await prompts({
    type: 'confirm',
    name: 'continue',
    message: 'Presiona enter para volver al menú',
    initial: true,
  }, promptsConfig);
}

// ---------------------------------------------------------------
// ACCIONES
// ---------------------------------------------------------------

async function actionModularize() {
  console.log('\n' + styles.divider());
  console.log(styles.section('  MODULARIZAR OAS3.x'));
  console.log(styles.divider());

  const response = await prompts({
    type: 'text',
    name: 'inputPath',
    message: 'Ruta del archivo OAS3.x',
    initial: C.modularizeInput || './api/openapi.yaml',
    validate: (value) => value.trim() !== '' ? true : 'La ruta no puede estar vacía',
  }, promptsConfig);

  if (!response.inputPath) {
    throw new Error('Operación cancelada por el usuario');
  }

  console.log('');
  const modularizer = createModularizer();
  await modularizer.run(response.inputPath);
}

async function actionBundle() {
  console.log('\n' + styles.divider());
  console.log(styles.section('  CONSOLIDAR OAS3.x (BUNDLE)'));
  console.log(styles.divider());

  const inputResponse = await prompts({
    type: 'text',
    name: 'inputPath',
    message: 'Archivo modular principal (entrypoint)',
    initial: MAIN_FILE,
    validate: (value) => value.trim() !== '' ? true : 'La ruta no puede estar vacía',
  }, promptsConfig);

  if (!inputResponse.inputPath) {
    throw new Error('Operación cancelada por el usuario');
  }

  const outputResponse = await prompts({
    type: 'text',
    name: 'outputPath',
    message: 'Ruta de salida del Bundle',
    initial: C.bundleOutput || './dist/bundle.yaml',
    validate: (value) => value.trim() !== '' ? true : 'La ruta no puede estar vacía',
  }, promptsConfig);

  if (!outputResponse.outputPath) {
    throw new Error('Operación cancelada por el usuario');
  }

  const bundler = createBundleGenerator();
  await bundler.generate(inputResponse.inputPath, outputResponse.outputPath);
}

async function actionDocs() {
  console.log('\n' + styles.divider());
  console.log(styles.section('  GENERAR DOCUMENTACIÓN'));
  console.log(styles.divider());

  const exampleBundle = C.bundleOutput || './dist/bundle.yaml';

  const inputResponse = await prompts({
    type: 'text',
    name: 'inputPath',
    message: 'Archivo OAS3.x de entrada (Bundle)',
    initial: exampleBundle,
    validate: (value) => value.trim() !== '' ? true : 'La ruta no puede estar vacía',
  }, promptsConfig);

  if (!inputResponse.inputPath) {
    throw new Error('Operación cancelada por el usuario');
  }

  const outputResponse = await prompts({
    type: 'text',
    name: 'outputPath',
    message: 'Ruta de salida del Markdown',
    initial: C.docsOutput || './docs/api.md',
    validate: (value) => value.trim() !== '' ? true : 'La ruta no puede estar vacía',
  }, promptsConfig);

  if (!outputResponse.outputPath) {
    throw new Error('Operación cancelada por el usuario');
  }

  await generateMarkdownDocs(inputResponse.inputPath, outputResponse.outputPath);
  printResult('Documentación generada exitosamente', 'success');
}

async function actionExportSwagger2() {
  console.log('\n' + styles.divider());
  console.log(styles.section('  EXPORTAR A SWAGGER 2.0'));
  console.log(styles.divider());

  const exampleInput = C.swagger2Input || C.bundleOutput || './dist/bundle.yaml';

  const inputResponse = await prompts({
    type: 'text',
    name: 'inputPath',
    message: 'Bundle OAS3.x de entrada',
    initial: exampleInput,
    validate: (value) => value.trim() !== '' ? true : 'La ruta no puede estar vacía',
  }, promptsConfig);

  if (!inputResponse.inputPath) {
    throw new Error('Operación cancelada por el usuario');
  }

  const suggestedOutput = C.swagger2Output || buildDefaultSwagger2Output(inputResponse.inputPath);

  const outputResponse = await prompts({
    type: 'text',
    name: 'outputPath',
    message: 'Ruta de salida de Swagger 2.0',
    initial: suggestedOutput || './dist/swagger2.yaml',
    validate: (value) => value.trim() !== '' ? true : 'La ruta no puede estar vacía',
  }, promptsConfig);

  if (!outputResponse.outputPath) {
    throw new Error('Operación cancelada por el usuario');
  }

  await downgradeToSwagger2(inputResponse.inputPath, outputResponse.outputPath);
  printResult('Exportación a Swagger 2.0 completada', 'success');
}

// ---------------------------------------------------------------
// MENÚ PRINCIPAL
// ---------------------------------------------------------------

const MENU_ACTIONS = [
  {
    id: 1,
    label: 'Modularizar OAS3.x',
    description: 'Divide la especificación OAS3.x en múltiples archivos',
    action: actionModularize,
  },
  {
    id: 2,
    label: 'Consolidar OAS3.x',
    description: 'Resuelve referencias y une todos los archivos en un Bundle',
    action: actionBundle,
  },
  {
    id: 3,
    label: 'Generar Documentación',
    description: 'Genera documentación Markdown desde el Bundle',
    action: actionDocs,
  },
  {
    id: 4,
    label: 'Exportar a Swagger 2.0',
    description: 'Convierte OAS3.x a Swagger 2.0 (downgrade)',
    action: actionExportSwagger2,
  },
];

/**
 * Muestra el menú principal y ejecuta acciones
 */
async function showMenu() {
  console.clear();

  // Obtener versión desde archivo VERSION
  let version;
  try {
    version = getVersionDisplay();
  } catch (error) {
    version = 'v?.?.?';
    console.warn(styles.warn(`No se pudo leer VERSION: ${error.message}`));
  }

  console.log('\n' + styles.divider());
  console.log(styles.header(`  OpenAPI Builder ${version}`));
  console.log(styles.divider() + '\n');

  // Mostrar opciones enumeradas
  console.log(chalk.bold('Selecciona una acción:\n'));
  MENU_ACTIONS.forEach((action) => {
    console.log(chalk.cyan(`  ${action.id}) ${action.label}`));
    console.log(styles.help(`     ${action.description}`));
  });
  console.log(chalk.red(`  5) Salir`));
  console.log(styles.help(`     Cierra la aplicación\n`));

  // Solicitar número de opción
  const response = await prompts({
    type: 'number',
    name: 'action',
    message: 'Ingresa el número de la acción',
    initial: 1,
    validate: (value) => {
      if (isNaN(value) || value < 1 || value > 5) {
        return 'Ingresa un número entre 1 y 5';
      }
      return true;
    },
  }, promptsConfig);

  if (response.action === 5 || response.action === undefined) {
    console.log('\n' + styles.header('👋 ¡Hasta luego!'));
    console.log(styles.divider() + '\n');
    process.exit(0);
  }

  const selectedAction = MENU_ACTIONS.find((a) => a.id === response.action);

  if (selectedAction) {
    try {
      await selectedAction.action();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      printResult(message, 'error');
    }
  }

  // Pausa antes de volver al menú
  await pause();
  await showMenu();
}

/**
 * Inicia la aplicación
 */
async function startApplication() {
  try {
    await showMenu();
  } catch (error) {
    console.error(styles.error(String(error)));
    process.exit(1);
  }
}

module.exports = {
  showMenu,
  startApplication,
};