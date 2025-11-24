// ./bin/application/docs.js

const path = require("path");
const chalk = require("chalk");

const { resolveExecutable } = require("../infrastructure/executables");
const { runCommand } = require("../infrastructure/runCommand");

// ---------------------------------------------------------------
// Generación de documentación Markdown con Widdershins
// ---------------------------------------------------------------

async function generateMarkdownDocs(inputPath, outputPath) {
  console.log(chalk.cyan("\n📝 Generando documentación Markdown...\n"));

  const widdershinsPath = resolveExecutable("widdershins");

  if (!widdershinsPath) {
    throw new Error(
      "❌ No se encontró el ejecutable de widdershins en node_modules/.bin"
    );
  }

  const command = [
    `"${widdershinsPath}"`,
    `"${inputPath}"`,
    "-o",
    `"${outputPath}"`
  ].join(" ");

  await runCommand(command);

  console.log(chalk.green(`\n✅ Documentación generada en: ${outputPath}\n`));
}

module.exports = {
  generateMarkdownDocs,
};
