/**
 * // bin/infrastructure/version.js
 * =============================================================================
 * VERSION.JS — Gestión centralizada de versión
 * =============================================================================
 *
 * Lee la versión desde package.json (única fuente de verdad).
 *
 * USO:
 *   const { getVersion } = require('./infrastructure/version');
 *   console.log(getVersion()); // "1.2.3"
 *
 * ACTUALIZACIÓN DE VERSIÓN:
 *   npm version patch   # 1.0.0 → 1.0.1
 *   npm version minor   # 1.0.0 → 1.1.0
 *   npm version major   # 1.0.0 → 2.0.0
 *
 * =============================================================================
 */

const path = require('path');

/**
 * Ruta al package.json (raíz del proyecto)
 */
const PACKAGE_JSON_PATH = path.resolve(__dirname, '../../package.json');

/**
 * Versión cacheada para evitar lecturas repetidas
 */
let cachedVersion = null;

/**
 * Lee y retorna la versión del proyecto desde package.json.
 *
 * @param {Object} [options] - Opciones
 * @param {boolean} [options.useCache=true] - Usar versión cacheada si existe
 * @returns {string} Versión del proyecto (ej: "1.2.3")
 * @throws {Error} Si no se puede leer package.json
 *
 * @example
 * const version = getVersion();
 * console.log(`App v${version}`); // "App v1.2.3"
 */
function getVersion({ useCache = true } = {}) {
  if (useCache && cachedVersion) {
    return cachedVersion;
  }

  try {
    // Limpiar caché de require para obtener valor actualizado
    if (!useCache) {
      delete require.cache[require.resolve(PACKAGE_JSON_PATH)];
    }
    
    const pkg = require(PACKAGE_JSON_PATH);
    
    if (!pkg.version) {
      throw new Error('El campo "version" no existe en package.json');
    }

    cachedVersion = pkg.version;
    return cachedVersion;
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      throw new Error(`No se encontró package.json en: ${PACKAGE_JSON_PATH}`);
    }
    throw error;
  }
}

/**
 * Retorna la versión formateada para mostrar en UI.
 *
 * @param {Object} [options] - Opciones de formato
 * @param {boolean} [options.prefix=true] - Incluir prefijo "v"
 * @param {string} [options.label] - Etiqueta adicional (ej: "beta", "rc1")
 * @returns {string} Versión formateada (ej: "v1.2.3-beta")
 *
 * @example
 * getVersionDisplay(); // "v1.2.3"
 * getVersionDisplay({ prefix: false }); // "1.2.3"
 * getVersionDisplay({ label: 'beta' }); // "v1.2.3-beta"
 */
function getVersionDisplay({ prefix = true, label = '' } = {}) {
  const version = getVersion();
  const prefixStr = prefix ? 'v' : '';
  const labelStr = label ? `-${label}` : '';
  return `${prefixStr}${version}${labelStr}`;
}

/**
 * Compara la versión actual con otra versión.
 *
 * @param {string} otherVersion - Versión a comparar
 * @returns {number} -1 si actual < otra, 0 si igual, 1 si actual > otra
 *
 * @example
 * compareVersion('1.2.0'); // 1 (actual es mayor)
 * compareVersion('1.2.3'); // 0 (iguales)
 * compareVersion('2.0.0'); // -1 (actual es menor)
 */
function compareVersion(otherVersion) {
  const current = getVersion().split('.').map(Number);
  const other = otherVersion.replace(/^v/i, '').split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    if (current[i] > other[i]) return 1;
    if (current[i] < other[i]) return -1;
  }
  return 0;
}

/**
 * Limpia la versión cacheada (útil para testing).
 */
function clearCache() {
  cachedVersion = null;
}

module.exports = {
  getVersion,
  getVersionDisplay,
  compareVersion,
  clearCache,
};