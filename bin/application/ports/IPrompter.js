// bin/application/ports/IPrompter.js

/**
 * Port: Prompter
 * Define contrato para interacción con usuario
 */
class IPrompter {
  /**
   * Pregunta de confirmación (sí/no)
   * @param {string} message - Mensaje a mostrar
   * @param {boolean} defaultValue - Valor por defecto
   * @returns {Promise<boolean>}
   */
  async confirm(message, defaultValue = false) {
    throw new Error('Not implemented');
  }

  /**
   * Pregunta de texto libre
   * @param {string} message - Mensaje a mostrar
   * @param {string} defaultValue - Valor por defecto
   * @returns {Promise<string>}
   */
  async text(message, defaultValue = '') {
    throw new Error('Not implemented');
  }

  /**
   * Selección de opción
   * @param {string} message - Mensaje a mostrar
   * @param {Array<{value, title}>} choices - Opciones disponibles
   * @returns {Promise<any>}
   */
  async select(message, choices) {
    throw new Error('Not implemented');
  }
}

module.exports = { IPrompter };