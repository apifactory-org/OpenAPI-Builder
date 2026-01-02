// bin/domain/entities/PathFile.js

/**
 * Entity: Representa un archivo de path modularizado
 * 
 * Responsabilidad:
 * - Conocer su ruta original (ej: "/user/{username}")
 * - Generar su nombre de archivo según convenciones
 * - Construir su ruta relativa
 */
class PathFile {
  /**
   * @param {string} route - Ruta original (ej: "/user/{username}")
   * @param {object} content - Contenido del path (operaciones, etc.)
   * @param {object} config - Configuración (naming, affixes, etc.)
   */
  constructor(route, content, config) {
    this.route = route
    this.content = content
    this.config = config
    this.fileName = this._generateFileName()
  }

  /**
   * Retorna la ruta relativa desde la raíz del proyecto
   * Ejemplo: "paths/user-username.yaml"
   */
  getRelativePath() {
    const ext = this.config.advanced?.fileExtension || '.yaml'
    return `paths/${this.fileName}${ext}`
  }

  /**
   * Genera el nombre del archivo según convenciones
   */
  _generateFileName() {
    const pathConvention = this.config.naming?.paths || 'kebab-case'
    const slug = this._slugifyPath(this.route)
    return this._applyConvention(slug, pathConvention)
  }

  /**
   * Convierte una ruta a slug
   * Ejemplo: "/user/{username}" → "user-username"
   */
  _slugifyPath(route) {
    return route
      .replace(/^\//, '')                    // Quitar "/" inicial
      .replace(/\/$/, '')                    // Quitar "/" final
      .replace(/\{([^}]+)\}/g, '$1')        // {param} → param
      .replace(/[^a-zA-Z0-9]+/g, '-')       // Caracteres especiales → "-"
      .replace(/^-+|-+$/g, '')              // Limpiar "-" al inicio/fin
      .toLowerCase()
  }

  /**
   * Aplica convención de naming (kebab-case, camelCase, etc.)
   */
  _applyConvention(name, convention) {
    // Aquí iría la lógica delegada al NameNormalizerService
    // Por ahora, asumimos kebab-case
    return name
  }

  /**
   * Genera el comentario de header para el archivo
   */
  getHeaderComment() {
    return `============================================\n${this.route}\n============================================`
  }

  /**
   * Extrae los parámetros de path de la ruta
   * Ejemplo: "/user/{username}" → ["username"]
   */
  getPathParams() {
    const params = []
    const re = /\{([^}]+)\}/g
    let match
    
    while ((match = re.exec(this.route)) !== null) {
      params.push(match[1])
    }
    
    return params
  }
}

module.exports = { PathFile }