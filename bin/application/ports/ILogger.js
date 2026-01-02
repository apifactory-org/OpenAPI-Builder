// bin/application/ports/ILogger.js

/**
 * Port: Logger
 * Define contrato para logging
 */
class ILogger {
  /**
   * Log de nivel debug
   * @param {string} message - Mensaje
   * @param {Object} context - Contexto adicional
   */
  debug(message, context = {}) {
    throw new Error('Not implemented');
  }

  /**
   * Log de nivel info
   * @param {string} message - Mensaje
   * @param {Object} context - Contexto adicional
   */
  info(message, context = {}) {
    throw new Error('Not implemented');
  }

  /**
   * Log de nivel warn
   * @param {string} message - Mensaje
   * @param {Object} context - Contexto adicional
   */
  warn(message, context = {}) {
    throw new Error('Not implemented');
  }

  /**
   * Log de nivel error
   * @param {string} message - Mensaje
   * @param {Error} error - Error
   * @param {Object} context - Contexto adicional
   */
  error(message, error, context = {}) {
    throw new Error('Not implemented');
  }

  /**
   * Log de sección (para separar visualmente)
   * @param {string} title - Título de la sección
   */
  section(title) {
    throw new Error('Not implemented');
  }

  /**
   * Log de paso en proceso
   * @param {string} message - Mensaje del paso
   */
  step(message) {
    throw new Error('Not implemented');
  }

  /**
   * Log de éxito
   * @param {string} message - Mensaje de éxito
   */
  success(message) {
    throw new Error('Not implemented');
  }
}

module.exports = { ILogger };