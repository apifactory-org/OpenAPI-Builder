// bin/core/namingConventions.js

/**
 * Convierte un nombre a diferentes convenciones
 */

/**
 * Convierte una cadena a un array de palabras
 * Detecta: CamelCase, snake_case, kebab-case, espacios
 */
function toWords(name) {
  if (!name || typeof name !== 'string') return [];
  
  // Reemplaza separadores comunes
  let str = name
    .replace(/([a-z])([A-Z])/g, '$1 $2') // CamelCase → spaces
    .replace(/_/g, ' ') // snake_case → spaces
    .replace(/-/g, ' ') // kebab-case → spaces
    .toLowerCase()
    .trim();
  
  return str.split(/\s+/).filter(w => w.length > 0);
}

/**
 * Aplica una convención de nombre
 * @param {string} name - Nombre original
 * @param {string} convention - Convención: PascalCase, camelCase, snake_case, kebab-case, lowercase, UPPERCASE
 * @returns {string} - Nombre con la convención aplicada
 */
function applyNamingConvention(name, convention = 'PascalCase') {
  if (!name || typeof name !== 'string') return '';
  
  const words = toWords(name);
  if (words.length === 0) return name;

  switch (convention) {
    case 'PascalCase':
      return words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
    
    case 'camelCase':
      return words[0].toLowerCase() + words.slice(1)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join('');
    
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
      return applyNamingConvention(name, 'PascalCase');
  }
}

/**
 * Aplica prefijos y sufijos a un nombre
 * @param {string} name - Nombre con convención ya aplicada
 * @param {string} prefix - Prefijo (ej: "Schema", "Request")
 * @param {string} suffix - Sufijo (ej: "Schema", "Request")
 * @returns {string}
 */
function applyAffixes(name, prefix = '', suffix = '') {
  if (!name || typeof name !== 'string') return '';
  
  let result = name;
  
  if (prefix && typeof prefix === 'string' && prefix.length > 0) {
    result = prefix + result;
  }
  
  if (suffix && typeof suffix === 'string' && suffix.length > 0) {
    result = result + suffix;
  }
  
  return result;
}

/**
 * Valida que una convención sea válida
 * @param {string} convention - Convención a validar
 * @returns {boolean}
 */
function isValidConvention(convention) {
  const valid = ['PascalCase', 'camelCase', 'snake_case', 'kebab-case', 'lowercase', 'UPPERCASE'];
  return valid.includes(convention);
}

/**
 * Aplica convención completa: nombre → convención → prefijo/sufijo
 * @param {string} name - Nombre original
 * @param {string} convention - Convención (PascalCase, camelCase, etc)
 * @param {string} prefix - Prefijo opcional
 * @param {string} suffix - Sufijo opcional
 * @returns {string} - Nombre final con todo aplicado
 */
function applyFullNaming(name, convention = 'PascalCase', prefix = '', suffix = '') {
  if (!name || typeof name !== 'string') return '';
  
  // 1. Aplicar convención de nombres
  let result = applyNamingConvention(name, convention);
  
  // 2. Aplicar prefijo y sufijo
  result = applyAffixes(result, prefix, suffix);
  
  return result;
}

module.exports = {
  toWords,
  applyNamingConvention,
  isValidConvention,
  applyAffixes,
  applyFullNaming,
};