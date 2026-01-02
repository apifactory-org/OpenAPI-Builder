// bin/domain/value-objects/FilePath.js

const path = require('path');

/**
 * Value Object: Ruta de archivo con validación y operaciones
 */
class FilePath {
  constructor(pathString) {
    this.validate(pathString);
    this.value = path.normalize(pathString);
  }

  validate(pathString) {
    if (!pathString || typeof pathString !== 'string') {
      throw new Error('La ruta debe ser un string no vacío');
    }

    if (pathString.trim().length === 0) {
      throw new Error('La ruta no puede estar vacía');
    }
  }

  toString() {
    return this.value;
  }

  getDirectory() {
    return new FilePath(path.dirname(this.value));
  }

  getFilename() {
    return path.basename(this.value);
  }

  getExtension() {
    return path.extname(this.value);
  }

  withExtension(ext) {
    const dir = path.dirname(this.value);
    const base = path.basename(this.value, this.getExtension());
    return new FilePath(path.join(dir, base + ext));
  }

  join(...segments) {
    return new FilePath(path.join(this.value, ...segments));
  }

  resolve(other) {
    return new FilePath(path.resolve(this.value, other.toString()));
  }

  isAbsolute() {
    return path.isAbsolute(this.value);
  }

  equals(other) {
    return other instanceof FilePath && 
           path.normalize(this.value) === path.normalize(other.value);
  }
}

module.exports = { FilePath };