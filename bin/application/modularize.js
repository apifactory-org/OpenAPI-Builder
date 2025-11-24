// bin/application/modularize.js

const path = require('path');
const chalk = require('chalk');

const { readYamlFile, writeYamlFile } = require('../infrastructure/yamlUtils');
const { removeDirIfExists, ensureDir, fileExists } = require('../infrastructure/fileSystem');
const { slugifyPath } = require('../core/slugifyPath');
const { fixRefs } = require('../core/fixRefs');
const { validateWithRedocly } = require('./validate');
const { loadAllConfigs } = require('../infrastructure/configLoader');

// ---------------------------------------------------------------------------
// CARGA DE CONFIGURACIÓN
// ---------------------------------------------------------------------------

const configs = loadAllConfigs();
const modularizeConfig = configs.modularize;

// Validaciones estrictas: nada de defaults silenciosos
if (!modularizeConfig) {
  throw new Error('❌ No existe archivo de configuración: config/modularize.yaml');
}

if (!modularizeConfig.paths) {
  throw new Error('❌ FALTA config.modularize.paths en config/modularize.yaml');
}

if (!modularizeConfig.behavior) {
  throw new Error('❌ FALTA config.modularize.behavior en config/modularize.yaml');
}

if (!modularizeConfig.advanced) {
  throw new Error('❌ FALTA config.modularize.advanced en config/modularize.yaml');
}

const pathsConfig = modularizeConfig.paths;
const behaviorConfig = modularizeConfig.behavior;
const modularizationConfig = modularizeConfig.modularization || {};
const advancedConfig = modularizeConfig.advanced;

// Ruta de entrada por defecto (si el CLI no pasa una explícita)
const DEFAULT_INPUT = pathsConfig.input;
if (!DEFAULT_INPUT || typeof DEFAULT_INPUT !== 'string') {
  throw new Error('❌ FALTA o es inválido: config.modularize.paths.input (string requerido)');
}

// Directorio base donde se generará la estructura modular (paths/, components/, etc.)
const TARGET_DIR = pathsConfig.modularizedOutput;
if (!TARGET_DIR || typeof TARGET_DIR !== 'string') {
  throw new Error(
    '❌ FALTA o es inválido: config.modularize.paths.modularizedOutput (string requerido)'
  );
}

// Normalizar ruta
const NORMALIZED_TARGET_DIR = path.normalize(TARGET_DIR);

// Subcarpetas dentro del directorio modularizado
const COMPONENTS_DIR = path.join(NORMALIZED_TARGET_DIR, 'components');
const PATHS_DIR = path.join(NORMALIZED_TARGET_DIR, 'paths');

// Extensión de archivos generados (debe venir de config)
const FILE_EXTENSION = advancedConfig.fileExtension;
if (!FILE_EXTENSION || typeof FILE_EXTENSION !== 'string') {
  throw new Error(
    '❌ FALTA o es inválido: config.modularize.advanced.fileExtension (string requerido, ej: ".yaml")'
  );
}

// Archivo principal OpenAPI modularizado (entrypoint)
const MAIN_FILE = path.join(NORMALIZED_TARGET_DIR, `openapi${FILE_EXTENSION}`);

// Flags de comportamiento: sin defaults, deben ser booleanos en config
if (typeof behaviorConfig.cleanModularizedOutput !== 'boolean') {
  throw new Error(
    '❌ FALTA o es inválido: config.modularize.behavior.cleanModularizedOutput (boolean requerido)'
  );
}
const CLEAN_MOD_OUTPUT = behaviorConfig.cleanModularizedOutput;

if (typeof behaviorConfig.fixRefs !== 'boolean') {
  throw new Error(
    '❌ FALTA o es inválido: config.modularize.behavior.fixRefs (boolean requerido)'
  );
}
const FIX_REFS = behaviorConfig.fixRefs;

// ---------------------------------------------------------------------------
// Validación del campo openapi
// ---------------------------------------------------------------------------

function assertValidOpenApiVersion(value) {
  if (typeof value !== 'string') {
    throw new Error(
      `El campo "openapi" debe ser un string con la versión del spec (por ejemplo "3.0.1"). Valor actual: ${JSON.stringify(
        value
      )}`
    );
  }

  const re = /^3\.\d+(\.\d+)?$/;
  if (!re.test(value.trim())) {
    throw new Error(
      `El campo "openapi" tiene un valor no estándar: "${value}". Debe ser algo como "3.0.1" o "3.1.0".`
    );
  }
}

// ---------------------------------------------------------------------------
// Lógica principal de modularización
// ---------------------------------------------------------------------------

async function modularize(inputPathFromCli) {
  const inputPath = inputPathFromCli || DEFAULT_INPUT;

  console.log(chalk.blue('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.blue(`🚀 Iniciando modularización de: ${inputPath}`));
  console.log(chalk.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));

  try {
    if (!fileExists(inputPath)) {
      throw new Error(`El archivo de entrada no se encontró en: ${inputPath}.`);
    }

    const oasData = readYamlFile(inputPath);

    // Validación rápida del campo `openapi` para evitar sorpresas extrañas
    assertValidOpenApiVersion(oasData.openapi);

    // Limpiar directorio target según configuración
    if (CLEAN_MOD_OUTPUT) {
      removeDirIfExists(NORMALIZED_TARGET_DIR);
    }

    // Crear directorios base
    ensureDir(COMPONENTS_DIR);
    ensureDir(PATHS_DIR);
    console.log(chalk.green(`✔ Directorios creados en: ${NORMALIZED_TARGET_DIR}`));

    // Construir el nuevo objeto OAS principal (entrypoint)
    const newOas = {
      openapi: oasData.openapi,
      info: oasData.info,
      servers: oasData.servers || [],
      tags: oasData.tags || [],
      security: oasData.security || [],
      externalDocs: oasData.externalDocs || undefined,
      paths: {},
      components: {},
    };

    // Copiar extensiones x-* de nivel raíz (ej: x-bcp-api-type, x-bcp-api-id)
    Object.entries(oasData).forEach(([key, value]) => {
      if (key.startsWith('x-')) {
        newOas[key] = value;
      }
    });

    // ─────────────────────────────
    // Modularizar components
    // ─────────────────────────────
    const components = oasData.components || {};
    console.log(chalk.cyan('\n📦 Descomponiendo components:'));

    for (const [key, content] of Object.entries(components)) {
      if (content && Object.keys(content).length > 0) {
        const componentFileName = `${key}${FILE_EXTENSION}`;
        const componentFilePath = path.join(COMPONENTS_DIR, componentFileName);

        const finalContent = FIX_REFS ? fixRefs(content, key) : content;
        writeYamlFile(componentFilePath, finalContent);

        newOas.components[key] = {
          $ref: `./components/${componentFileName}`,
        };
      }
    }

    // ─────────────────────────────
    // Modularizar paths
    // ─────────────────────────────
    const originalPaths = oasData.paths || {};
    console.log(chalk.cyan('\n🗺  Descomponiendo paths:'));

    for (const [routePath, pathObject] of Object.entries(originalPaths)) {
      if (pathObject && Object.keys(pathObject).length > 0) {
        const pathFileName = `${slugifyPath(routePath).replace(/\.yaml$/, '')}${FILE_EXTENSION}`;
        const pathFilePath = path.join(PATHS_DIR, pathFileName);

        const finalPathObject = FIX_REFS ? fixRefs(pathObject, 'paths') : pathObject;
        writeYamlFile(pathFilePath, finalPathObject);

        newOas.paths[routePath] = {
          $ref: `./paths/${pathFileName}`,
        };
      } else {
        console.log(chalk.yellow(`  • Ruta ignorada por estar vacía: '${routePath}'`));
      }
    }

    // ─────────────────────────────
    // Guardar archivo principal modular
    // ─────────────────────────────
    console.log(chalk.cyan('\n📝 Escribiendo archivo principal modular:'));
    writeYamlFile(MAIN_FILE, newOas);

    // ─────────────────────────────
    // Validar con Redocly
    // ─────────────────────────────
    await validateWithRedocly(MAIN_FILE);

    console.log(chalk.green('\n✨ Modularización completada exitosamente.'));
    console.log(chalk.green(`   Carpeta generada: ${NORMALIZED_TARGET_DIR}`));
  } catch (error) {
    console.error(chalk.red('\n✖ Error al modularizar:'), error.message);
    process.exit(1);
  }
}

module.exports = {
  modularize,
  TARGET_DIR: NORMALIZED_TARGET_DIR,
  COMPONENTS_DIR,
  PATHS_DIR,
  MAIN_FILE,
};
