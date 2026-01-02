// bin/domain/services/ModelValidator.js

/**
 * Domain Service: Valida el modelo antes de escribir
 * 
 * Responsabilidad:
 * - Verificar que todas las referencias estén resueltas
 * - Verificar estructura correcta
 * - Detectar problemas antes de tocar el disco
 */
class ModelValidator {
  constructor(logger) {
    this.logger = logger
  }

  /**
   * Valida el modelo completo
   * @returns {object} { isValid: boolean, errors: string[] }
   */
  validate(model) {
    this.logger.info("Validando modelo...")
    
    const errors = []
    
    // 1. Validar que haya al menos un component o path
    if (model.stats.componentsCount === 0 && model.stats.pathsCount === 0) {
      errors.push("El modelo está vacío: no hay components ni paths")
    }
    
    // 2. Validar referencias no resueltas en components
    for (const componentFile of model.getAllComponents()) {
      const componentErrors = this._validateReferencesInObject(
        componentFile.content,
        `Component ${componentFile.type}/${componentFile.name}`
      )
      errors.push(...componentErrors)
    }
    
    // 3. Validar referencias no resueltas en paths
    for (const pathFile of model.getAllPaths()) {
      const pathErrors = this._validateReferencesInObject(
        pathFile.content,
        `Path ${pathFile.route}`
      )
      errors.push(...pathErrors)
    }
    
    // 4. Validar entrypoint
    if (!model.entrypoint.openapi) {
      errors.push("Falta campo 'openapi' en entrypoint")
    }
    if (!model.entrypoint.info) {
      errors.push("Falta campo 'info' en entrypoint")
    }
    
    // Resultado
    const isValid = errors.length === 0
    
    if (isValid) {
      this.logger.success("✓ Modelo válido")
    } else {
      this.logger.error(`✗ Modelo inválido: ${errors.length} errores`)
      errors.forEach(err => this.logger.error(`  - ${err}`))
    }
    
    return { isValid, errors }
  }

  /**
   * Valida referencias en un objeto recursivamente
   */
  _validateReferencesInObject(obj, context) {
    const errors = []
    
    if (!obj || typeof obj !== 'object') return errors
    
    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        const itemErrors = this._validateReferencesInObject(item, `${context}[${index}]`)
        errors.push(...itemErrors)
      })
      return errors
    }
    
    // Verificar $ref
    if (obj.$ref && typeof obj.$ref === 'string') {
      // Verificar que no queden referencias sin resolver (#/components/...)
      if (obj.$ref.startsWith('#/components/')) {
        errors.push(`Referencia no resuelta en ${context}: ${obj.$ref}`)
      }
    }
    
    // Recursión
    for (const [key, value] of Object.entries(obj)) {
      const childErrors = this._validateReferencesInObject(value, `${context}.${key}`)
      errors.push(...childErrors)
    }
    
    return errors
  }
}

module.exports = { ModelValidator }