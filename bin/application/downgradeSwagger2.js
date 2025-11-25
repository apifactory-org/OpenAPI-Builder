// bin/application/downgradeSwagger2.js

const path = require("path");
const chalk = require("chalk");

const { resolveExecutable } = require("../infrastructure/executables");
const { ensureDir } = require("../infrastructure/fileSystem");
const { runCommand } = require("../infrastructure/runCommand");
const { loadAllConfigs } = require("../infrastructure/configLoader");

// ---------------------------------------------------------
// CARGA CONFIGURACIÓN (solo para defaults / ejemplos)
// ---------------------------------------------------------
const configs = loadAllConfigs();

// Config específica de swagger2 (puede venir del proyecto o del paquete)
const swagger2Config = configs.swagger2 || {};
const swagger2Paths = swagger2Config.paths || {};

// Config modularize (para posibles fallbacks como bundleOutput)
const modularizeConfig = configs.modularize || {};
const modularizePaths = modularizeConfig.paths || {};

// ---------------------------------------------------------
// UTILIDADES
// ---------------------------------------------------------

/**
 * Construye la ruta por defecto para el archivo Swagger 2.0
 * a partir de un bundle OpenAPI 3 de entrada.
 *
 * Ej:
 *  ./dist/openapi.yaml  →  ./dist/openapi.swagger2.yaml
 */
function buildDefaultSwagger2Output(inputPath) {
  const dir = path.dirname(inputPath);
  const base = path.basename(inputPath).replace(/\.(ya?ml|json)$/i, "");
  return path.join(dir, `${base}.swagger2.yaml`);
}

// ---------------------------------------------------------
// FUNCIÓN PRINCIPAL
// ---------------------------------------------------------

/**
 * Downgrade OpenAPI 3.x → Swagger 2.0 usando api-spec-converter (CLI).
 *
 * Resolución de rutas:
 *  - inputPathFromCli      → prioridad 1 (vía CLI o menú)
 *  - swagger2.paths.input  → prioridad 2 (config/swagger2.yaml)
 *  - modularize.paths.bundleOutput → prioridad 3 (config/modularize.yaml)
 *
 *  - outputPathFromCli     → prioridad 1
 *  - swagger2.paths.output → prioridad 2
 *  - buildDefaultSwagger2Output(inputPath) → prioridad 3
 *
 * @param {string} [inputPathFromCli]  Ruta al bundle OAS3
 * @param {string} [outputPathFromCli] Ruta al Swagger 2.0 de salida
 */
async function downgradeToSwagger2(inputPathFromCli, outputPathFromCli) {
  const inputPath =
    inputPathFromCli ||
    swagger2Paths.input ||
    modularizePaths.bundleOutput ||
    null;

  if (!inputPath || typeof inputPath !== "string") {
    throw new Error(
      '❌ No se pudo determinar el bundle OpenAPI 3 de entrada.\n' +
        "   Proporciona la ruta de alguna de estas formas:\n" +
        "   - Pasando el parámetro de entrada al comando (CLI/menú), o\n" +
        "   - Configurando paths.input en config/swagger2.yaml, o\n" +
        "   - Configurando paths.bundleOutput en config/modularize.yaml."
    );
  }

  const finalOutput =
    outputPathFromCli ||
    swagger2Paths.output ||
    buildDefaultSwagger2Output(inputPath);

  console.log(chalk.cyan("\n⬇️  Convirtiendo OpenAPI 3 → Swagger 2.0...\n"));
  console.log(chalk.gray(`   Entrada : ${inputPath}`));
  console.log(chalk.gray(`   Salida  : ${finalOutput}\n`));

  const converterPath = resolveExecutable("api-spec-converter");

  if (!converterPath) {
    console.error(chalk.red('\n✖ No se encontró el ejecutable de "api-spec-converter".'));
    console.error(
      chalk.red(
        '   Asegúrate de que "api-spec-converter" está instalado como dependencia del CLI\n' +
          "   o del proyecto que consume la herramienta."
      )
    );
    process.exit(1);
  }

  ensureDir(path.dirname(finalOutput));

  // api-spec-converter CLI:
  //   api-spec-converter --from=openapi_3 --to=swagger_2 --syntax=yaml archivo.yaml > salida.yaml
  //
  // Usamos redirección ">" porque runCommand ejecuta el comando en shell.
  const command = [
    `"${converterPath}"`,
    "--from=openapi_3",
    "--to=swagger_2",
    "--syntax=yaml",
    `"${inputPath}"`,
    ">",
    `"${finalOutput}"`,
  ].join(" ");

  try {
    const { stdout } = await runCommand(command);
    if (stdout && stdout.trim()) {
      console.log(stdout);
    }

    console.log(chalk.bold.green(`\n✅ Swagger 2.0 generado en: ${finalOutput}\n`));
  } catch (error) {
    console.error(chalk.red("\n✖ Error al convertir a Swagger 2.0:\n"));
    console.error(error.stdout || error.message || error);
    throw error;
  }
}

module.exports = {
  downgradeToSwagger2,
  buildDefaultSwagger2Output,
};
