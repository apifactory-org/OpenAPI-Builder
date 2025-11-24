// bin/interface/cli.js

const path = require("path");
const { program } = require("commander");
const chalk = require("chalk");

const { loadAllConfigs } = require("../infrastructure/configLoader");

const { modularize, MAIN_FILE } = require("../application/modularize");
const { bundleWithRedocly } = require("../application/bundle");
const { generateMarkdownDocs } = require("../application/docs");
const { showMenu } = require("./menu");

// ---------------------------------------------------------------
// Carga de configuración (solo para defaults / placeholders)
// ---------------------------------------------------------------
const configs = loadAllConfigs();

const modularizeConfig = configs.modularize || {};
const bundleConfig = configs.bundle || {};

const modularizePaths = modularizeConfig.paths || {};
const bundlePaths = bundleConfig.paths || {};

// ⚠️ IMPORTANTE: los "ej: ..." solo usan valores reales de config.
// Si no hay config, NO se inventa una ruta de ejemplo.
const modularizeInputExampleSuffix = modularizePaths.input
  ? ` (ej: ${modularizePaths.input})`
  : "";

const bundleInputExampleSuffix = MAIN_FILE
  ? ` (ej: ${MAIN_FILE})`
  : "";

const bundleOutputExampleSuffix = bundlePaths.bundleOutput
  ? ` (ej: ${bundlePaths.bundleOutput})`
  : "";

const docsInputExampleSuffix = bundlePaths.bundleOutput
  ? ` (ej: ${bundlePaths.bundleOutput})`
  : "";

const docsOutputExampleSuffix = modularizePaths.docsOutput
  ? ` (ej: ${modularizePaths.docsOutput})`
  : "";

// ---------------------------------------------------------------
// Configuración del CLI
// ---------------------------------------------------------------
program
  .name("oas3-modularize")
  .description(
    "Utilidades para OAS3: modularizar, validar, generar bundle y producir documentación Markdown."
  )
  .version("1.0.3");

// ---------------------------------------------------------------
// Subcomando: modularizar
// ---------------------------------------------------------------
program
  .command("modularize")
  .requiredOption(
    "--build <file>",
    `Ruta al archivo OpenAPI YAML de entrada${modularizeInputExampleSuffix}`
  )
  .description(
    "Descompone un archivo OAS3 monolítico en una estructura modular (src/) y ajusta referencias."
  )
  .action(async (options) => {
    try {
      console.log(chalk.blue("\n🚀 Ejecutando comando: modularize\n"));
      await modularize(options.build);
      console.log(chalk.green("\n✅ Comando modularize completado.\n"));
    } catch (err) {
      console.error(chalk.red("\n✖ Error ejecutando modularize:"), err);
      process.exit(1);
    }
  });

// ---------------------------------------------------------------
// Subcomando: bundle
// ---------------------------------------------------------------
program
  .command("bundle")
  .option(
    "-i, --input <file>",
    `Archivo modular principal de entrada${bundleInputExampleSuffix}`
    // SIN default efectivo aquí: se resuelve dentro del action.
  )
  .option(
    "-o, --output <file>",
    `Archivo bundle de salida${bundleOutputExampleSuffix}`
    // SIN default efectivo aquí: se resuelve dentro del action.
  )
  .description("Genera un bundle único desde la estructura modular usando Redocly CLI.")
  .action(async (options) => {
    try {
      console.log(chalk.blue("\n📦 Ejecutando comando: bundle\n"));

      // INPUT:
      // 1) prioridad: bandera --input
      // 2) si no: MAIN_FILE (calculado a partir de config/modularize)
      const input = options.input || MAIN_FILE;
      if (!input) {
        throw new Error(
          "No se pudo determinar el archivo de entrada para el bundle. " +
            "Pasa --input explícitamente o asegúrate de tener config/modularize.yaml válido."
        );
      }

      // OUTPUT:
      // 1) prioridad: bandera --output
      // 2) si no: config/bundle.yaml → paths.bundleOutput
      const output = options.output || bundlePaths.bundleOutput;
      if (!output) {
        throw new Error(
          "No se pudo determinar el archivo de salida del bundle. " +
            "Define config/bundle.yaml (paths.bundleOutput) o pasa --output."
        );
      }

      await bundleWithRedocly(input, output);

      console.log(chalk.green("\n✅ Comando bundle completado.\n"));
    } catch (err) {
      console.error(chalk.red("\n✖ Error ejecutando bundle:"), err);
      process.exit(1);
    }
  });

// ---------------------------------------------------------------
// Subcomando: docs
// ---------------------------------------------------------------
program
  .command("docs")
  .option(
    "-i, --input <file>",
    `Archivo OpenAPI de entrada para generar documentación${docsInputExampleSuffix}`
  )
  .option(
    "-o, --output <file>",
    `Archivo Markdown de salida${docsOutputExampleSuffix}`
  )
  .description("Genera documentación Markdown desde un archivo OpenAPI.")
  .action(async (options) => {
    try {
      console.log(chalk.blue("\n📚 Ejecutando comando: docs\n"));

      // INPUT:
      // 1) prioridad: --input
      // 2) si no: config/bundle.yaml → paths.bundleOutput
      const input = options.input || bundlePaths.bundleOutput;
      if (!input) {
        throw new Error(
          "No se pudo determinar el archivo de entrada para docs. " +
            "Pasa --input explícitamente o define config/bundle.yaml (paths.bundleOutput)."
        );
      }

      // OUTPUT:
      // 1) prioridad: --output
      // 2) si no: config/modularize.yaml → paths.docsOutput
      const output = options.output || modularizePaths.docsOutput;
      if (!output) {
        throw new Error(
          "No se pudo determinar el archivo de salida para docs. " +
            "Pasa --output explícitamente o define config/modularize.yaml (paths.docsOutput)."
        );
      }

      await generateMarkdownDocs(input, output);

      console.log(chalk.green("\n✅ Comando docs completado.\n"));
    } catch (err) {
      console.error(chalk.red("\n✖ Error generando documentación:"), err);
      process.exit(1);
    }
  });

// ---------------------------------------------------------------
// Ejecución CLI
// ---------------------------------------------------------------

if (process.argv.length <= 2) {
  showMenu().catch((err) => {
    console.error(chalk.red("\n✖ Error en el menú interactivo:"), err);
    process.exit(1);
  });
} else {
  program.parse(process.argv);
}
