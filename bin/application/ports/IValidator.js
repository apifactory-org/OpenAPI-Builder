// bin/application/ports/IValidator.js

/**
 * Port: Validador de documentos OpenAPI
 * Define contrato para validación de especificaciones
 */
class IValidator {
  /**
   * Valida un documento OpenAPI
   * @param {FilePath} filePath - Ruta del documento a validar
   * @returns {Promise<ValidationResult>}
   */
  async validate(filePath) {
    throw new Error('Not implemented');
  }
}

/**
 * Resultado de validación
 */
class ValidationResult {
  constructor(isValid, errors = [], warnings = []) {
    this.isValid = isValid;
    this.errors = errors;
    this.warnings = warnings;
  }

  hasErrors() {
    return this.errors.length > 0;
  }

  hasWarnings() {
    return this.warnings.length > 0;
  }
}

module.exports = { IValidator, ValidationResult };