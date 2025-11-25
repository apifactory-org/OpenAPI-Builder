// bin/interface/menu.js

const path = require("path");
const inquirer = require("inquirer");
const chalk = require("chalk");

const { loadAllConfigs } = require("../infrastructure/configLoader");

const { modularize, MAIN_FILE } = require("../application/modularize");
const { bundleWithRedocly } = require("../application/bundle");
const { generateMarkdownDocs } = require("../application/docs");
const {
  downgradeToSwagger2,
  buildDefaultSwagger2Output
} = require("../application/downgradeSwagger2");

// ---------------------------------------------------------------
// Carga de configuración (solo para sugerir defaults / ejemplos)
// ---------------------------------------------------------------
const configs = loadAllConfigs();
const modularizeConfig = configs.modularize || {};
const modularizePaths = modularizeConfig.paths || {};

// Config específica de swagger2 (opcional)
const swagger2Config = configs.swagger2 || {};
const swagger2Paths = swagger2Config.paths || {};

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
        { name: "2) Generar bundle (Redocly)", value: "bundle" },
        { name: "3) Generar documentación Markdown", value: "docs" },
        {
          name: "4) Ejecutar pipeline completo (modularize → bundle → docs)",
          value: "build-all",
        },
        {
          name: "5) Downgradear bundle OpenAPI 3 → Swagger 2.0",
          value: "downgrade-swagger2"
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
      const msg =
        "Ruta al archivo OpenAPI YAML de entrada" +
        (modularizePaths.input ? ` (ej: ${modularizePaths.input})` : "") +
        ":";

      const { input } = await inquirer.prompt([
        {
          type: "input",
          name: "input",
          message: msg,
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
      const inputMsg =
        "Archivo modular principal (entrypoint)" +
        (MAIN_FILE ? ` (ej: ${MAIN_FILE})` : "") +
        ":";

      const outputMsg =
        "Ruta de salida del bundle" +
        (modularizePaths.bundleOutput
          ? ` (ej: ${modularizePaths.bundleOutput})`
          : "") +
        ":";

      const answers = await inquirer.prompt([
        {
          type: "input",
          name: "input",
          message: inputMsg,
          default: MAIN_FILE || undefined,
        },
        {
          type: "input",
          name: "output",
          message: outputMsg,
          default: modularizePaths.bundleOutput || undefined,
        },
      ]);

      await bundleWithRedocly(answers.input, answers.output);
      break;
    }

    // -----------------------------------------------------------
    // DOCUMENTACIÓN MARKDOWN
    // -----------------------------------------------------------
    case "docs": {
      const inputMsg =
        "Archivo OpenAPI de entrada (normalmente el bundle)" +
        (modularizePaths.bundleOutput
          ? ` (ej: ${modularizePaths.bundleOutput})`
          : "") +
        ":";

      const outputMsg =
        "Ruta de salida del Markdown" +
        (modularizePaths.docsOutput ? ` (ej: ${modularizePaths.docsOutput})` : "") +
        ":";

      const answers = await inquirer.prompt([
        {
          type: "input",
          name: "input",
          message: inputMsg,
          default: modularizePaths.bundleOutput || undefined,
        },
        {
          type: "input",
          name: "output",
          message: outputMsg,
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
      const inputMsg =
        "Ruta al archivo OpenAPI YAML de entrada" +
        (modularizePaths.input ? ` (ej: ${modularizePaths.input})` : "") +
        ":";

      const { input } = await inquirer.prompt([
        {
          type: "input",
          name: "input",
          message: inputMsg,
          default: modularizePaths.input || undefined,
        },
      ]);

      const { bundleOutput } = await inquirer.prompt([
        {
          type: "input",
          name: "bundleOutput",
          message:
            "Ruta de salida del bundle" +
            (modularizePaths.bundleOutput
              ? ` (ej: ${modularizePaths.bundleOutput})`
              : "") +
            ":",
          default: modularizePaths.bundleOutput || undefined,
        },
      ]);

      const { docsOutput } = await inquirer.prompt([
        {
          type: "input",
          name: "docsOutput",
          message:
            "Ruta de salida del Markdown" +
            (modularizePaths.docsOutput ? ` (ej: ${modularizePaths.docsOutput})` : "") +
            ":",
          default: modularizePaths.docsOutput || undefined,
        },
      ]);

      await modularize(input);
      await bundleWithRedocly(MAIN_FILE, bundleOutput);
      await generateMarkdownDocs(bundleOutput, docsOutput);
      break;
    }

    // -----------------------------------------------------------
    // DOWNGRADE OPENAPI 3 → SWAGGER 2.0
    // -----------------------------------------------------------
    case "downgrade-swagger2": {
      const exampleInput =
        swagger2Paths.input || modularizePaths.bundleOutput || "";

      const inputMsg =
        "Bundle OpenAPI 3 de entrada" +
        (exampleInput ? ` (ej: ${exampleInput})` : "") +
        ":";

      const { input } = await inquirer.prompt([
        {
          type: "input",
          name: "input",
          message: inputMsg,
          default: swagger2Paths.input || modularizePaths.bundleOutput || undefined,
        },
      ]);

      const suggestedOutput =
        swagger2Paths.output ||
        buildDefaultSwagger2Output(input || exampleInput);

      const outputMsg =
        "Ruta de salida Swagger 2.0" +
        (suggestedOutput ? ` (ej: ${suggestedOutput})` : "") +
        ":";

      const { output } = await inquirer.prompt([
        {
          type: "input",
          name: "output",
          message: outputMsg,
          default: suggestedOutput || undefined,
        },
      ]);

      await downgradeToSwagger2(input, output);
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
