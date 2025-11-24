// bin/interface/menu.js

const inquirer = require("inquirer");
const chalk = require("chalk");

const { loadAllConfigs } = require("../infrastructure/configLoader");

const { modularize, MAIN_FILE } = require("../application/modularize");
const { bundleWithRedocly } = require("../application/bundle");
const { generateMarkdownDocs } = require("../application/docs");

// ---------------------------------------------------------------
// Carga de configuración (solo para sugerir defaults / ejemplos)
// ---------------------------------------------------------------
const configs = loadAllConfigs();
const modularizeConfig = configs.modularize || {};
const bundleConfig = configs.bundle || {};

const modularizePaths = modularizeConfig.paths || {};
const bundlePaths = bundleConfig.paths || {};

// ---------------------------------------------------------------
// MENÚ PRINCIPAL
// ---------------------------------------------------------------
async function showMenu() {
  console.log(chalk.bold.cyan("\n🧩 oas3-modularize - Menú interactivo\n"));

  const { action } = await inquirer.prompt([
    {
      type: "list",
      name: "action",
      message: "¿Qué quieres hacer?",
      choices: [
        { name: "1) Modularizar un archivo OpenAPI YAML", value: "modularize" },
        { name: "2) Generar bundle (motor configurable)", value: "bundle" },
        { name: "3) Generar documentación Markdown", value: "docs" },
        {
          name: "4) Ejecutar pipeline completo (modularize → bundle → docs)",
          value: "build-all",
        },
        { name: "Salir", value: "exit" },
      ],
    },
  ]);

  if (action === "exit") {
    console.log(chalk.gray("\n👋 Saliendo..."));
    return;
  }

  switch (action) {
    // -----------------------------------------------------------
    // MODULARIZAR
    // -----------------------------------------------------------
    case "modularize": {
      const modularizeInputMessage =
        "Ruta al archivo OpenAPI YAML de entrada" +
        (modularizePaths.input ? ` (ej: ${modularizePaths.input})` : "") +
        ":";

      const { input } = await inquirer.prompt([
        {
          type: "input",
          name: "input",
          message: modularizeInputMessage,
          // Default solo si viene de config; si no, el usuario debe escribirla.
          default: modularizePaths.input || undefined,
        },
      ]);

      await modularize(input);
      break;
    }

    // -----------------------------------------------------------
    // BUNDLE
    // -----------------------------------------------------------
    case "bundle": {
      const bundleInputMessage =
        "Archivo modular principal (entrypoint)" +
        (MAIN_FILE ? ` (ej: ${MAIN_FILE})` : "") +
        ":";

      const bundleOutputMessage =
        "Ruta de salida del bundle" +
        (bundlePaths.bundleOutput ? ` (ej: ${bundlePaths.bundleOutput})` : "") +
        ":";

      const answers = await inquirer.prompt([
        {
          type: "input",
          name: "input",
          message: bundleInputMessage,
          // Default: MAIN_FILE si existe; si no, el usuario debe ponerla.
          default: MAIN_FILE || undefined,
        },
        {
          type: "input",
          name: "output",
          message: bundleOutputMessage,
          // Default: config/bundle.yaml → paths.bundleOutput si existe; si no, vacío.
          default: bundlePaths.bundleOutput || undefined,
        },
      ]);

      await bundleWithRedocly(answers.input, answers.output);
      break;
    }

    // -----------------------------------------------------------
    // DOCUMENTACIÓN MARKDOWN
    // -----------------------------------------------------------
    case "docs": {
      const docsInputMessage =
        "Archivo OpenAPI de entrada (normalmente el bundle)" +
        (bundlePaths.bundleOutput ? ` (ej: ${bundlePaths.bundleOutput})` : "") +
        ":";

      const docsOutputMessage =
        "Ruta de salida del Markdown" +
        (modularizePaths.docsOutput ? ` (ej: ${modularizePaths.docsOutput})` : "") +
        ":";

      const answers = await inquirer.prompt([
        {
          type: "input",
          name: "input",
          message: docsInputMessage,
          // Default: paths.bundleOutput si existe; si no, usuario manda.
          default: bundlePaths.bundleOutput || undefined,
        },
        {
          type: "input",
          name: "output",
          message: docsOutputMessage,
          // Default: paths.docsOutput si existe; si no, usuario manda.
          default: modularizePaths.docsOutput || undefined,
        },
      ]);

      await generateMarkdownDocs(answers.input, answers.output);
      break;
    }

    // -----------------------------------------------------------
    // PIPELINE COMPLETO
    // -----------------------------------------------------------
    case "build-all": {
      // 1) Pedimos la entrada monolítica
      const modularizeInputMessage =
        "Ruta al archivo OpenAPI YAML de entrada" +
        (modularizePaths.input ? ` (ej: ${modularizePaths.input})` : "") +
        ":";

      const { input } = await inquirer.prompt([
        {
          type: "input",
          name: "input",
          message: modularizeInputMessage,
          default: modularizePaths.input || undefined,
        },
      ]);

      // 2) Bundle output
      const bundleOutputMessage =
        "Ruta de salida del bundle" +
        (bundlePaths.bundleOutput ? ` (ej: ${bundlePaths.bundleOutput})` : "") +
        ":";

      const { bundleOutput } = await inquirer.prompt([
        {
          type: "input",
          name: "bundleOutput",
          message: bundleOutputMessage,
          default: bundlePaths.bundleOutput || undefined,
        },
      ]);

      // 3) Docs output
      const docsOutputMessage =
        "Ruta de salida del Markdown" +
        (modularizePaths.docsOutput ? ` (ej: ${modularizePaths.docsOutput})` : "") +
        ":";

      const { docsOutput } = await inquirer.prompt([
        {
          type: "input",
          name: "docsOutput",
          message: docsOutputMessage,
          default: modularizePaths.docsOutput || undefined,
        },
      ]);

      // Ejecutar pipeline
      await modularize(input);
      await bundleWithRedocly(MAIN_FILE, bundleOutput);
      await generateMarkdownDocs(bundleOutput, docsOutput);
      break;
    }

    default:
      console.log(chalk.red("Opción no reconocida."));
  }

  console.log(chalk.bold.green("\n✅ Operación finalizada.\n"));
}

module.exports = {
  showMenu,
};
