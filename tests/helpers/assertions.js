// tests/helpers/assertions.js

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

/**
 * Assertions personalizadas para tests de OpenAPI
 */
class OpenAPIAssertions {
  /**
   * Verifica que un directorio tenga la estructura esperada de modularización
   */
  static assertModularStructure(baseDir) {
    expect(fs.existsSync(baseDir)).toBe(true);
    expect(fs.existsSync(path.join(baseDir, 'main.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(baseDir, 'paths'))).toBe(true);
    expect(fs.existsSync(path.join(baseDir, 'components'))).toBe(true);
  }

  /**
   * Verifica que un archivo YAML sea válido y contenga campos esperados
   */
  static assertValidOpenAPIFile(filePath, requiredFields = []) {
    expect(fs.existsSync(filePath)).toBe(true);
    
    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = yaml.load(content);
    
    expect(parsed).toBeDefined();
    
    requiredFields.forEach(field => {
      expect(parsed).toHaveProperty(field);
    });
    
    return parsed;
  }

  /**
   * Verifica que un path tenga referencias relativas correctas
   */
  static assertHasRelativeRefs(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    // ✅ CORREGIDO: Usar .toContain() en vez de regex problemática
    expect(content).toContain('$ref: ../');
  }

  /**
   * Cuenta archivos en un directorio recursivamente
   */
  static countFiles(dir, extension = '.yaml') {
    if (!fs.existsSync(dir)) {
      return 0;
    }
    
    let count = 0;
    
    const walk = (currentDir) => {
      const files = fs.readdirSync(currentDir, { withFileTypes: true });
      
      files.forEach(file => {
        const fullPath = path.join(currentDir, file.name);
        
        if (file.isDirectory()) {
          walk(fullPath);
        } else if (file.name.endsWith(extension)) {
          count++;
        }
      });
    };
    
    walk(dir);
    return count;
  }
}

module.exports = { OpenAPIAssertions };