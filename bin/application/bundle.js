// bin/application/bundle.js

const path = require('path');
const chalk = require('chalk');

const { resolveExecutable } = require('../infrastructure/executables');
const { ensureDir, removeDirIfExists } = require('../infrastructure/fileSystem');
const { runCommand } = require('../infrastructure/runCommand');
const { loadAllConfigs } = require('../infrastructure/configLoader');
const { readYamlFile, writeYamlFile } = require('../infrastructure/yamlUtils');

// ---------------------------------------------------------
// CARGA CONFIGURACIÓN (EXCLUSIVA DE BUNDLE)
// ---------------------------------------------------------
const configs = loadAllConfigs();
const bundleRootConfig = configs.bundle;

if (!bundleRootConfig) {
  throw new Error('❌ No existe archivo de configuración: config/bundle.yaml');
}

if (!bundleRootConfig.paths) {
  throw new Error('❌ FALTA config.bundle.paths en config/bundle.yaml');
}

if (!bundleRootConfig.behavior) {
  throw new Error('❌ FALTA config.bundle.behavior en config/bundle.yaml');
}

if (!bundleRootConfig.bundle) {
  throw new Error('❌ FALTA config.bundle.bundle en config/bundle.yaml');
}

const pathsConfig = bundleRootConfig.paths;
const behaviorConfig = bundleRootConfig.behavior;
const bundleConfig = bundleRootConfig.bundle;

const REQUIRED_BUNDLE_FIELDS = [
  'dereference',
  'removeUnusedComponents',
  'injectFormat',
  'validate',
];

for (const field of REQUIRED_BUNDLE_FIELDS) {
  if (typeof bundleConfig[field] !== 'boolean') {
    throw new Error(
      `❌ FALTA o es inválido: config.bundle.bundle.${field} (debe ser booleano)`
    );
  }
}

const DEFAULT_OUTPUT = pathsConfig.bundleOutput;
if (!DEFAULT_OUTPUT || typeof DEFAULT_OUTPUT !== 'string') {
  throw new Error(
    '❌ FALTA o es inválido: config.bundle.paths.bundleOutput (string requerido)'
  );
}

const CLEAN_DIST =
  typeof behaviorConfig.cleanDist === 'boolean'
    ? behaviorConfig.cleanDist
    : (() => {
        throw new Error(
          '❌ FALTA o es inválido: config.bundle.behavior.cleanDist (boolean requerido)'
        );
      })();

const DEREF = bundleConfig.dereference;
const REMOVE_UNUSED = bundleConfig.removeUnusedComponents;
const INJECT_FORMAT = bundleConfig.injectFormat;
const VALIDATE = bundleConfig.validate;

// ---------------------------------------------------------
// EJECUTA REDOCLY BUNDLE
// ---------------------------------------------------------
/**
 * Paso 1: genera un bundle "plano" (sin remove-unused-components).
 * Paso 2 (opcional): si config.bundle.bundle.removeUnusedComponents === true,
 *                    ejecuta una segunda pasada de Redocly para eliminar
 *                    los components no usados sobre el bundle ya generado.
 * Paso 3 (opcional): si !dereference, reescribe el YAML sin anchors (&ref_*).
 */
async function bundleWithRedocly(inputPath, outputPath) {
  if (!inputPath || typeof inputPath !== 'string') {
    throw new Error('❌ Debes indicar un entrypoint válido para el bundle (inputPath).');
  }

  const finalOutput = outputPath || DEFAULT_OUTPUT;

  console.log(chalk.cyan('\n📦 Generando bundle con Redocly...\n'));

  const redoclyPath = resolveExecutable('redocly');

  if (!redoclyPath) {
    console.error(
      chalk.red('\n✖ No se encontró Redocly CLI en node_modules/.bin.')
    );
    console.error(
      chalk.red('Instala @redocly/cli o verifica que las dependencias estén instaladas.')
    );
    process.exit(1);
  }

  const distDir = path.dirname(finalOutput);

  if (CLEAN_DIST) {
    removeDirIfExists(distDir);
  }
  ensureDir(distDir);

  // -----------------------------------------------------
  // PASO 1: bundle "plano" (sin remove-unused-components)
  // -----------------------------------------------------
  const flagsPaso1 = [];

  if (DEREF) flagsPaso1.push('--dereferenced');
  if (INJECT_FORMAT) flagsPaso1.push('--inject-format');
  if (!VALIDATE) flagsPaso1.push('--skip-rule=all');

  const commandPaso1 = [
    `"${redoclyPath}"`,
    'bundle',
    `"${inputPath}"`,
    '-o',
    `"${finalOutput}"`,
    ...flagsPaso1,
  ].join(' ');

  console.log(chalk.gray('ℹ Ejecutando paso 1: bundle plano (sin remove-unused-components)...'));
  const { stdout: stdout1 } = await runCommand(commandPaso1);
  if (stdout1 && stdout1.trim()) console.log(stdout1);

  // -----------------------------------------------------
  // PASO 2 (opcional): remove-unused-components sobre el bundle ya generado
  // -----------------------------------------------------
  if (REMOVE_UNUSED) {
    console.log(
      chalk.gray(
        'ℹ Ejecutando paso 2: limpieza de components no usados (--remove-unused-components) sobre el bundle generado...'
      )
    );

    const flagsPaso2 = [];

    // ⚠ Aquí NO agregamos --dereferenced ni --inject-format:
    //    solo queremos que Redocly identifique y elimine components no usados.
    if (!VALIDATE) flagsPaso2.push('--skip-rule=all');
    flagsPaso2.push('--remove-unused-components');

    const commandPaso2 = [
      `"${redoclyPath}"`,
      'bundle',
      `"${finalOutput}"`, // input: el bundle ya generado en el paso 1
      '-o',
      `"${finalOutput}"`, // output: se sobrescribe el mismo archivo
      ...flagsPaso2,
    ].join(' ');

    const { stdout: stdout2 } = await runCommand(commandPaso2);
    if (stdout2 && stdout2.trim()) console.log(stdout2);
  }

  // -----------------------------------------------------
  // PASO 3 (opcional): reescritura sin anchors YAML
  // -----------------------------------------------------
  // Solo tiene sentido hacerlo cuando NO está dereferenciado.
  if (!DEREF) {
    try {
      const bundledObject = readYamlFile(finalOutput);
      writeYamlFile(finalOutput, bundledObject);
      console.log(chalk.gray('ℹ Bundle reescrito sin anchors YAML (noRefs:true).'));
    } catch (postErr) {
      console.warn(
        chalk.yellow(
          `⚠ No se pudo reescribir el bundle sin anchors: ${postErr.message || postErr}`
        )
      );
    }
  } else {
    console.log(
      chalk.gray(
        'ℹ Bundle dereferenciado: se omite reescritura sin anchors para evitar ciclos.'
      )
    );
  }

  console.log(chalk.bold.green(`\n✅ Bundle generado en: ${finalOutput}\n`));
}

module.exports = {
  bundleWithRedocly,
};
