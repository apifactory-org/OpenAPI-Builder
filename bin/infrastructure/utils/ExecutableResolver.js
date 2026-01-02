// bin/infrastructure/utils/ExecutableResolver.js

const path = require('path');
const fs = require('fs');

/**
 * Servicio: Resolución de ejecutables en node_modules/.bin
 */
class ExecutableResolver {
  /**
   * Resuelve la ruta a un ejecutable
   */
  resolve(baseName) {
    // Determinar extensión según plataforma
    let exe = baseName;
    if (process.platform === 'win32') {
      exe = `${baseName}.cmd`;
    }

    // BUSCAR en el proyecto actual (process.cwd())
    const binPath = path.join(process.cwd(), 'node_modules', '.bin', exe);
    
    if (fs.existsSync(binPath)) {
      return binPath;
    }

    return null;
  }

  /**
   * Verifica si un ejecutable existe
   */
  exists(baseName) {
    return this.resolve(baseName) !== null;
  }
}

module.exports = { ExecutableResolver };