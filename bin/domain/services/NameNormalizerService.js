// bin/domain/services/NameNormalizerService.js

/**
 * Domain Service: Normalización de nombres según convenciones
 */
class NameNormalizerService {
  constructor(config = {}) {
    this.config = config;
  }

  /**
   * Convierte una cadena a array de palabras
   */
  toWords(name) {
    if (!name || typeof name !== 'string') return [];

    let str = name
      .replace(/([a-z])([A-Z])/g, '$1 $2') // CamelCase → spaces
      .replace(/_/g, ' ') // snake_case → spaces
      .replace(/-/g, ' ') // kebab-case → spaces
      .toLowerCase()
      .trim();

    return str.split(/\s+/).filter(w => w.length > 0);
  }

  /**
   * Aplica convención de nombres
   */
  applyConvention(name, convention = 'PascalCase') {
    if (!name || typeof name !== 'string') return '';

    const words = this.toWords(name);
    if (words.length === 0) return name;

    switch (convention) {
      case 'PascalCase':
        return words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');

      case 'camelCase':
        return words[0].toLowerCase() +
          words.slice(1).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');

      case 'snake_case':
        return words.join('_');

      case 'kebab-case':
        return words.join('-');

      case 'lowercase':
        return words.join('');

      case 'UPPERCASE':
        return words.join('_').toUpperCase();

      default:
        console.warn(`⚠️  Convención desconocida: ${convention}, usando PascalCase`);
        return this.applyConvention(name, 'PascalCase');
    }
  }

  /**
   * Aplica prefijos y sufijos
   */
  applyAffixes(name, prefix = '', suffix = '') {
    if (!name || typeof name !== 'string') return '';

    let result = name;

    if (prefix && typeof prefix === 'string') {
      result = prefix + result;
    }

    if (suffix && typeof suffix === 'string') {
      result = result + suffix;
    }

    return result;
  }

  /**
   * Sanitiza nombre para uso como componente
   */
  sanitize(name) {
    if (!name || typeof name !== 'string') return '';
    
    return name
      .trim()
      .replace(/[^a-zA-Z0-9._-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Genera nombre completo para componente
   */
  generateComponentName(name, type, namingConfig = {}, affixesConfig = {}) {
    if (!name || typeof name !== 'string') return '';

    // Responses: no transformar (se maneja por responseNaming)
    if (type === 'responses') {
      return name;
    }

    // 1. Sanitizar
    const cleanBase = this.sanitize(name);

    // 2. Aplicar convención
    const convention = namingConfig.components || 'PascalCase';
    let fileName = this.applyConvention(cleanBase, convention);

    // 3. Aplicar affixes si están habilitados
    if (affixesConfig && affixesConfig.enabled) {
      const prefix = (affixesConfig.prefixes && affixesConfig.prefixes[type]) || '';
      const suffix = (affixesConfig.suffixes && affixesConfig.suffixes[type]) || '';
      fileName = this.applyAffixes(fileName, prefix, suffix);
    }

    return fileName;
  }

  /**
   * Convierte path a slug válido
   */
  slugifyPath(routePath) {
    let slug = routePath.replace(/\//g, '-');
    slug = slug.replace(/[{}]/g, '').replace(/^-/, '');
    
    if (slug === '') return 'root';
    
    return slug;
  }
}

module.exports = { NameNormalizerService };