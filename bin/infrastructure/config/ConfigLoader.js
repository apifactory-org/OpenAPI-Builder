// bin/infrastructure/config/ConfigLoader.js

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

/**
 * Servicio: Carga de configuración con fallbacks
 */
class ConfigLoader {
  constructor() {
    this.configFiles = {
      modularize: 'config/modularize.yaml',
      bundle: 'config/bundle.yaml',
      swagger2: 'config/swagger2.yaml',
      logging: 'config/logging.yaml'
    };
  }

  /**
   * Carga todos los archivos de configuración
   */
  loadAll() {
    return {
      modularize: this.load('modularize'),
      bundle: this.load('bundle'),
      swagger2: this.load('swagger2'),
      logging: this.load('logging')
    };
  }

  /**
   * Carga un archivo de configuración específico
   */
  load(configName) {
    const relativePath = this.configFiles[configName];
    
    if (!relativePath) {
      return null;
    }

    const filePath = this.resolve(relativePath);
    
    if (!filePath) {
      return null;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return yaml.load(content);
    } catch (error) {
      console.warn(`⚠️  Error cargando ${configName}: ${error.message}`);
      return null;
    }
  }

  /**
   * Resuelve ruta de configuración con fallbacks
   * 1. Proyecto del usuario (process.cwd())
   * 2. Paquete CLI (node_modules/@apifactory/...)
   */
  resolve(relativePath) {
    // 1. Proyecto del usuario
    const fromCwd = path.resolve(process.cwd(), relativePath);
    if (fs.existsSync(fromCwd)) {
      return fromCwd;
    }

    // 2. Paquete CLI
    const moduleRoot = path.resolve(__dirname, '..', '..');
    const fromModule = path.resolve(moduleRoot, relativePath);
    if (fs.existsSync(fromModule)) {
      return fromModule;
    }

    return null;
  }

  /**
   * Verifica si existe un archivo de configuración
   */
  exists(configName) {
    const relativePath = this.configFiles[configName];
    return this.resolve(relativePath) !== null;
  }
}

module.exports = { ConfigLoader };