// bin/infrastructure/yamlUtils.js

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

/**
 * Lee un archivo YAML y devuelve el objeto JavaScript.
 * @param {string} filePath
 * @returns {any}
 */
function readYamlFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return yaml.load(content);
}

/**
 * Escribe un objeto JavaScript como YAML en un archivo.
 * Crea los directorios si no existen.
 *
 * - noRefs: true => evita anchors y referencias (&ref, *ref)
 * - noCompatMode: true => desactiva comportamientos heredados
 * - lineWidth: -1 => no corta tus líneas arbitrariamente
 */
function writeYamlFile(filePath, data) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });

  const yamlText = yaml.dump(data, {
    indent: 2,
    noRefs: true,        // ← **EVITA anchors**
    noCompatMode: true,  // ← evita modos antiguos YAML 1.1
    lineWidth: -1        // ← no partas las líneas largas
  });

  fs.writeFileSync(filePath, yamlText, 'utf8');
}

module.exports = {
  readYamlFile,
  writeYamlFile,
};
