// bin/domain/entities/ComponentFile.js

/**
 * Entity: Representa un archivo de componente modularizado
 *
 * Responsabilidad:
 * - Conocer su ubicación exacta (type + subType)
 * - Generar su nombre de archivo según convenciones
 * - Construir su ruta relativa
 */
class ComponentFile {
  /**
   * @param {string} name - Nombre del componente (ej: "Username", "Pet")
   * @param {string} type - Tipo OAS (ej: "parameters", "schemas", "responses")
   * @param {string|null} subType - Subtipo (ej: "path", "query", "model", "enum")
   * @param {object} content - Contenido del componente
   * @param {object} config - Configuración (naming, affixes, etc.)
   */
  constructor(name, type, subType, content, config) {
    this.name = name;
    this.type = type;
    this.subType = subType;
    this.content = content;
    this.config = config;
    this.fileName = this._generateFileName();
  }

  /**
   * Retorna la ruta relativa desde la raíz del proyecto
   * Ejemplo: "components/parameters/path/UsernameParam.yaml"
   */
  getRelativePath() {
    const ext = this.config.advanced?.fileExtension || ".yaml";

    if (this.subType) {
      return `components/${this.type}/${this.subType}/${this.fileName}${ext}`;
    }

    return `components/${this.type}/${this.fileName}${ext}`;
  }

  /**
   * Retorna la ruta relativa desde otro archivo
   * @param {string} fromType - Tipo del archivo origen ('paths', 'schemas', etc.)
   */
  getRelativePathFrom(fromType) {
    const relativePath = this.getRelativePath();

    if (fromType === "paths") {
      return `../${relativePath}`;
    }

    if (fromType === this.type) {
      // Mismo tipo, puede estar en mismo directorio o subdirectorio
      const ext = this.config.advanced?.fileExtension || ".yaml";
      if (this.subType) {
        return `${this.subType}/${this.fileName}${ext}`;
      }
      return `./${this.fileName}${ext}`;
    }

    // Diferente tipo
    return `../${this.type}/${this.subType ? this.subType + "/" : ""}${
      this.fileName
    }${this.config.advanced?.fileExtension || ".yaml"}`;
  }

  /**
   * Genera el nombre del archivo según convenciones
   */
  _generateFileName() {
    const convention = this.config.naming?.components || "PascalCase";

    let cleanName = this.name;

    // Para parameters, limpiar prefijos de tipo
    if (this.type === "parameters") {
      // Remover prefijos como "query_", "path_"
      if (cleanName.includes("_")) {
        const parts = cleanName.split("_");
        const first = parts[0].toLowerCase();
        if (["header", "query", "path", "cookie"].includes(first)) {
          cleanName = parts.slice(1).join("_");
        }
      }

      // Remover sufijos semánticos
      cleanName = cleanName.replace(/(Header|Query|Path|Cookie|Param)$/i, "");
    }

    // ✅ FIX: Detectar y remover sufijos existentes ANTES de aplicar nuevos
    if (
      this.config.affixes?.enabled &&
      this.config.affixes?.suffixes?.[this.type]
    ) {
      const configuredSuffix = this.config.affixes.suffixes[this.type];

      // Si el nombre ya termina con el sufijo configurado, removerlo
      if (configuredSuffix && cleanName.endsWith(configuredSuffix)) {
        cleanName = cleanName.slice(0, -configuredSuffix.length);
      }
    }

    // Para enums, limpiar sufijo "Values" y también el sufijo de enum si existe
    if (this._isEnum() && this.config.affixes?.useEnumSuffix) {
      cleanName = cleanName.replace(/Values?$/i, "");

      // ✅ FIX: Remover sufijo de enum existente
      const enumSuffix = this.config.affixes?.enumSuffix || "Enum";
      if (cleanName.endsWith(enumSuffix)) {
        cleanName = cleanName.slice(0, -enumSuffix.length);
      }
    }

    // Aplicar convención de naming
    let fileName = this._applyConvention(cleanName, convention);

    // Aplicar sufijos según configuración
    if (
      this.config.affixes?.enabled &&
      this.config.affixes?.suffixes?.[this.type]
    ) {
      // Para enums, usar sufijo especial si está configurado
      if (this._isEnum() && this.config.affixes?.useEnumSuffix) {
        const enumSuffix = this.config.affixes?.enumSuffix || "Enum";
        fileName += enumSuffix;
      } else {
        fileName += this.config.affixes.suffixes[this.type];
      }
    }

    return fileName;
  }

  _isEnum() {
    return (
      this.content &&
      typeof this.content === "object" &&
      Array.isArray(this.content.enum) &&
      this.content.type === "string"
    );
  }

  _applyConvention(name, convention) {
    // Aquí iría la lógica de naming (delegada al NameNormalizerService)
    // Por ahora, asumimos PascalCase básico
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  /**
   * Crea una clave única para este componente
   * Útil para indexación sin colisiones
   */
  getKey() {
    return this.subType
      ? `${this.type}:${this.subType}:${this.name.toLowerCase()}`
      : `${this.type}:${this.name.toLowerCase()}`;
  }
}

module.exports = { ComponentFile };
