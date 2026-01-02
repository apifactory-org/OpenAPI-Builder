// bin/domain/value-objects/StatusCode.js

/**
 * Value Object: Código de estado HTTP con validación
 */
class StatusCode {
  constructor(code) {
    this.validate(code);
    this.value = code.toString();
  }

  validate(code) {
    const str = code.toString();
    
    if (str === 'default') {
      return; // 'default' es válido en OpenAPI
    }

    const numeric = parseInt(str, 10);
    
    if (isNaN(numeric)) {
      throw new Error(`Código de estado inválido: "${code}"`);
    }

    if (numeric < 100 || numeric >= 600) {
      throw new Error(`Código de estado fuera de rango: ${numeric}. Debe estar entre 100-599`);
    }
  }

  toString() {
    return this.value;
  }

  toNumber() {
    return this.value === 'default' ? null : parseInt(this.value, 10);
  }

  isDefault() {
    return this.value === 'default';
  }

  isSuccess() {
    const num = this.toNumber();
    return num >= 200 && num < 300;
  }

  isClientError() {
    const num = this.toNumber();
    return num >= 400 && num < 500;
  }

  isServerError() {
    const num = this.toNumber();
    return num >= 500 && num < 600;
  }

  inRange(start, end) {
    const num = this.toNumber();
    return num && num >= start && num < end;
  }

  equals(other) {
    return other instanceof StatusCode && this.value === other.value;
  }
}

module.exports = { StatusCode };