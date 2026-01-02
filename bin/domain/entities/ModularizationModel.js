// bin/domain/entities/ModularizationModel.js

/**
 * Entity: Modelo central que contiene toda la estructura modularizada
 * 
 * Responsabilidad:
 * - Almacenar todos los ComponentFile y PathFile
 * - Proveer búsqueda eficiente sin colisiones
 * - Mantener metadatos del entrypoint
 * 
 * NO tiene lógica de negocio compleja (eso va en Services)
 * Es un contenedor con búsqueda inteligente.
 */
class ModularizationModel {
  constructor() {
    /**
     * Mapa de componentes indexados por clave compuesta
     * Key: "type:subType:name" (ej: "parameters:path:username")
     * Value: ComponentFile
     */
    this.components = new Map()
    
    /**
     * Mapa de paths indexados por ruta
     * Key: route (ej: "/user/{username}")
     * Value: PathFile
     */
    this.paths = new Map()
    
    /**
     * Información del entrypoint (main.yaml)
     */
    this.entrypoint = {
      openapi: null,
      info: null,
      servers: null,
      tags: null,
      security: null,
      externalDocs: null,
      extensions: null,
      filePath: null
    }
    
    /**
     * Estadísticas (opcional, útil para logging)
     */
    this.stats = {
      componentsCount: 0,
      pathsCount: 0,
      componentsByType: {}
    }
  }

  /**
   * Agrega un ComponentFile al modelo
   */
  addComponent(componentFile) {
    if (!componentFile || !componentFile.getKey) {
      throw new Error('Invalid ComponentFile')
    }
    
    const key = componentFile.getKey()
    this.components.set(key, componentFile)
    
    // Actualizar estadísticas
    this.stats.componentsCount++
    if (!this.stats.componentsByType[componentFile.type]) {
      this.stats.componentsByType[componentFile.type] = 0
    }
    this.stats.componentsByType[componentFile.type]++
  }

  /**
   * Agrega un PathFile al modelo
   */
  addPath(pathFile) {
    if (!pathFile || !pathFile.route) {
      throw new Error('Invalid PathFile')
    }
    
    this.paths.set(pathFile.route, pathFile)
    
    // Actualizar estadísticas
    this.stats.pathsCount++
  }

  /**
   * Busca un componente por tipo, subtipo y nombre
   * ✅ Sin colisiones: usa clave compuesta
   */
  findComponent(type, subType, name) {
    const key = this._makeComponentKey(type, subType, name)
    return this.components.get(key)
  }

  /**
   * Busca un componente solo por tipo y nombre
   * ⚠️ Puede retornar múltiples resultados si hay colisiones
   */
  findComponentsByTypeAndName(type, name) {
    const results = []
    const nameLower = String(name).toLowerCase()
    
    for (const [key, component] of this.components.entries()) {
      if (component.type === type && component.name.toLowerCase() === nameLower) {
        results.push(component)
      }
    }
    
    return results
  }

  /**
   * Busca un path por ruta
   */
  findPath(route) {
    return this.paths.get(route)
  }

  /**
   * Retorna todos los componentes
   */
  getAllComponents() {
    return Array.from(this.components.values())
  }

  /**
   * Retorna todos los paths
   */
  getAllPaths() {
    return Array.from(this.paths.values())
  }

  /**
   * Retorna componentes filtrados por tipo
   */
  getComponentsByType(type) {
    return this.getAllComponents().filter(c => c.type === type)
  }

  /**
   * Retorna componentes filtrados por tipo y subtipo
   */
  getComponentsByTypeAndSubType(type, subType) {
    return this.getAllComponents().filter(
      c => c.type === type && c.subType === subType
    )
  }

  /**
   * Configura el entrypoint
   */
  setEntrypoint(data) {
    this.entrypoint = { ...this.entrypoint, ...data }
  }

  /**
   * Genera estadísticas del modelo
   */
  getStats() {
    return {
      ...this.stats,
      types: Object.keys(this.stats.componentsByType)
    }
  }

  /**
   * Crea una clave compuesta para búsqueda sin colisiones
   * @private
   */
  _makeComponentKey(type, subType, name) {
    const nameLower = String(name).toLowerCase()
    return subType 
      ? `${type}:${subType}:${nameLower}`
      : `${type}:${nameLower}`
  }
}

module.exports = { ModularizationModel }