// ./infrastructure/configLoader.js

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

// ARCHIVOS DE CONFIGURACIÓN OFICIALES DEL CLI
// Cada comando usa SOLO su config; no se mezclan.
const CONFIG_FILES = {
  modularize: "config/modularize.yaml",
  bundle: "config/bundle.yaml",
  normalize: "config/normalize.yaml",
  linter: "config/linter.yaml",
  logging: "config/logging.yaml"
};

/**
 * Carga un archivo YAML desde una ruta relativa al proyecto.
 * Si no existe, retorna null sin generar fallo.
 */
function loadYamlConfig(relativePath) {
  const filePath = path.resolve(process.cwd(), relativePath);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const raw = fs.readFileSync(filePath, "utf8");
  return yaml.load(raw);
}

/**
 * Carga TODAS las configuraciones disponibles.
 *
 * Los comandos deciden qué config usar:
 *   - modularize.js  → usa config.modularize
 *   - bundle.js      → usa config.bundle
 *   - validate.js    → depende del caso
 *   - docs.js        → usa config.modularize.paths.docsOutput
 */
function loadAllConfigs() {
  return {
    modularize: loadYamlConfig(CONFIG_FILES.modularize) || null,
    bundle: loadYamlConfig(CONFIG_FILES.bundle) || null,
    normalize: loadYamlConfig(CONFIG_FILES.normalize) || null,
    linter: loadYamlConfig(CONFIG_FILES.linter) || null,
    logging: loadYamlConfig(CONFIG_FILES.logging) || null
  };
}

module.exports = {
  loadAllConfigs,
  loadYamlConfig
};
