// bin/infrastructure/fileSystem.js

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { loadAllConfigs } = require('./configLoader');

// -------------------------------------------------------------
// Carga de configuración
// -------------------------------------------------------------
const { logging = {}, modularize = {} } = loadAllConfigs();
const logLevel = logging.level || 'info';
const logPrefix = logging.prefix || '[fs]';

function log(msg, level = 'info') {
  const levels = ['silent', 'error', 'warn', 'info', 'debug'];
  const idx = levels.indexOf(logLevel);
  const lvl = levels.indexOf(level);

  if (lvl <= idx && logLevel !== 'silent') {
    const colored =
      level === 'error'
        ? chalk.red(msg)
        : level === 'warn'
        ? chalk.yellow(msg)
        : level === 'debug'
        ? chalk.gray(msg)
        : chalk.cyan(msg);

    console.log(`${chalk.magenta(logPrefix)} ${colored}`);
  }
}

// -------------------------------------------------------------
// FILESYSTEM UTILITIES
// -------------------------------------------------------------

/**
 * Elimina un directorio de forma recursiva si existe.
 */
function removeDirIfExists(dirPath) {
  if (fs.existsSync(dirPath)) {
    log(`Eliminando directorio: ${dirPath}`, 'debug');
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

/**
 * Crea un directorio (y padres) si no existe.
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    log(`Creando directorio: ${dirPath}`, 'debug');
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Verifica si un archivo existe.
 */
function fileExists(filePath) {
  return fs.existsSync(filePath);
}

/**
 * Escribe un archivo garantizando que el directorio existe.
 */
function safeWriteFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf8');
  log(`Archivo escrito: ${filePath}`, 'debug');
}

/**
 * Copia un archivo creando directorio si es necesario.
 */
function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
  log(`Copiado archivo: ${src} → ${dest}`, 'debug');
}

/**
 * Lista archivos de forma recursiva.
 */
function listFilesRecursively(dir) {
  let results = [];

  if (!fs.existsSync(dir)) return results;

  const items = fs.readdirSync(dir);

  items.forEach((item) => {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) {
      results = results.concat(listFilesRecursively(full));
    } else {
      results.push(full);
    }
  });

  return results;
}

/**
 * Elimina recursivamente todos los directorios vacíos.
 * Ideal si advanced.removeEmptyFolders = true
 */
function removeEmptyDirsRecursively(dir) {
  if (!fs.existsSync(dir)) return;

  const files = fs.readdirSync(dir);

  // Primero procesar subdirectorios
  files.forEach((file) => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      removeEmptyDirsRecursively(fullPath);
    }
  });

  // Luego intentar borrar si está vacío
  const remaining = fs.readdirSync(dir);

  if (remaining.length === 0) {
    fs.rmdirSync(dir);
    log(`Directorio vacío eliminado: ${dir}`, 'debug');
  }
}

module.exports = {
  removeDirIfExists,
  ensureDir,
  fileExists,
  safeWriteFile,
  copyFile,
  listFilesRecursively,
  removeEmptyDirsRecursively,
};
