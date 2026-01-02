// bin/domain/services/ReferenceResolver.js

/**
 * Domain Service: Resuelve todas las referencias en el modelo
 * 
 * Responsabilidad:
 * - Recorrer todo el modelo (components y paths)
 * - Convertir referencias #/components/... a rutas relativas
 * - Resolver en memoria (sin tocar disco)
 */
class ReferenceResolver {
  constructor(logger) {
    this.logger = logger
  }

  /**
   * Resuelve todas las referencias en el modelo
   */
  resolve(model) {
    this.logger.info("Resolviendo referencias...")
    
    let resolvedCount = 0
    
    // Resolver en components
    for (const componentFile of model.getAllComponents()) {
      resolvedCount += this._resolveInObject(componentFile.content, componentFile, model)
    }
    
    // Resolver en paths
    for (const pathFile of model.getAllPaths()) {
      resolvedCount += this._resolveInObject(pathFile.content, pathFile, model)
    }
    
    this.logger.success(`${resolvedCount} referencias resueltas`)
    
    return resolvedCount
  }

  /**
   * Resuelve referencias en un objeto recursivamente
   */
  _resolveInObject(obj, fromFile, model) {
    if (!obj || typeof obj !== 'object') return 0
    
    let count = 0
    
    if (Array.isArray(obj)) {
      obj.forEach(item => {
        count += this._resolveInObject(item, fromFile, model)
      })
      return count
    }
    
    // Si tiene $ref, resolverlo
    if (obj.$ref && typeof obj.$ref === 'string') {
      const resolved = this._resolveReference(obj.$ref, fromFile, model)
      if (resolved !== obj.$ref) {
        obj.$ref = resolved
        count++
      }
    }
    
    // Recursión en propiedades
    for (const value of Object.values(obj)) {
      count += this._resolveInObject(value, fromFile, model)
    }
    
    return count
  }

  /**
   * Resuelve una referencia individual
   */
  _resolveReference(refString, fromFile, model) {
    // Si ya es una ruta relativa, no tocar
    if (refString.startsWith('./') || refString.startsWith('../')) {
      return refString
    }
    
    // Si es externa (http/https), no tocar
    if (/^https?:\/\//i.test(refString)) {
      return refString
    }
    
    // Parsear: #/components/parameters/Username
    const match = refString.match(/^#\/components\/([^/]+)\/([^/]+)$/)
    if (!match) return refString
    
    const [, type, name] = match
    
    // Buscar componente en el modelo
    const components = model.findComponentsByTypeAndName(type, name)
    
    if (components.length === 0) {
      this.logger.warn(`Referencia no encontrada: ${refString}`)
      return refString
    }
    
    if (components.length === 1) {
      // ✅ Un solo resultado: usar ese
      return this._buildRelativePath(fromFile, components[0])
    }
    
    // ⚠️ Múltiples resultados (colisión): usar heurística
    const bestMatch = this._selectBestMatch(components, refString, fromFile)
    return this._buildRelativePath(fromFile, bestMatch)
  }

  /**
   * Selecciona el mejor match cuando hay múltiples componentes con el mismo nombre
   */
  _selectBestMatch(components, refString, fromFile) {
    // Heurística simple: preferir mismo subType si fromFile lo tiene
    // Por ahora, tomar el primero
    // TODO: mejorar heurística si es necesario
    return components[0]
  }

  /**
   * Construye la ruta relativa entre dos archivos
   */
  _buildRelativePath(fromFile, toComponentFile) {
    // Determinar tipo del archivo origen
    const fromType = fromFile.type || 'paths'
    
    // Usar el método de ComponentFile
    return toComponentFile.getRelativePathFrom(fromType)
  }
}

module.exports = { ReferenceResolver }