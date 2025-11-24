// bin/infrastructure/executables.js

const path = require('path');
const fs = require('fs');

/**
 * Devuelve la ruta al ejecutable ubicado en el node_modules/.bin
 * del propio paquete @apifactory/oas3-modularize.
 *
 * Estructura típica cuando se instala:
 *   .../node_modules/@apifactory/oas3-modularize/bin/...
 *   .../node_modules/@apifactory/oas3-modularize/node_modules/.bin/<exe>
 *
 * @param {string} baseName Nombre base del ejecutable (ej: 'redocly', 'widdershins').
 * @returns {string} Ruta absoluta al ejecutable.
 */
function getBinPath(baseName) {
  // __dirname → .../@apifactory/oas3-modularize/bin/infrastructure
  const packageRoot = path.join(__dirname, '..', '..'); // subimos a .../@apifactory/oas3-modularize
  const binDir = path.join(packageRoot, 'node_modules', '.bin');

  let exe = baseName;
  if (process.platform === 'win32') {
    exe = `${baseName}.cmd`;
  }

  const fullPath = path.join(binDir, exe);
  return fullPath;
}

/**
 * Verifica que el ejecutable exista; si no, devuelve null.
 * @param {string} baseName
 * @returns {string | null}
 */
function resolveExecutable(baseName) {
  const p = getBinPath(baseName);
  return fs.existsSync(p) ? p : null;
}

module.exports = {
  getBinPath,
  resolveExecutable,
};
