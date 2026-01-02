// bin/domain/entities/OpenAPIDocument.js

/**
 * Entity: Representa un documento OpenAPI completo
 */
class OpenAPIDocument {
  constructor(data) {
    this.validate(data);
    
    this.openapi = data.openapi;
    this.info = data.info;
    this.servers = data.servers || [];
    this.tags = data.tags || [];
    this.security = data.security || [];
    this.externalDocs = data.externalDocs;
    this.paths = data.paths || {};
    this.components = data.components || {};
    
    // Preservar extensiones x-*
    this.extensions = this.extractExtensions(data);
  }

  validate(data) {
    if (!data.openapi) {
      throw new Error('Campo openapi es obligatorio');
    }
    
    if (!/^3\.\d+(\.\d+)?$/.test(data.openapi)) {
      throw new Error(`Versión OpenAPI inválida: ${data.openapi}. Debe ser 3.x`);
    }
    
    if (!data.info || !data.info.title || !data.info.version) {
      throw new Error('info.title e info.version son obligatorios');
    }
  }

  extractExtensions(data) {
    const extensions = {};
    Object.keys(data).forEach(key => {
      if (key.startsWith('x-')) {
        extensions[key] = data[key];
      }
    });
    return extensions;
  }

  getVersion() {
    return this.openapi;
  }

  hasComponents() {
    return Object.keys(this.components).length > 0;
  }

  hasPaths() {
    return Object.keys(this.paths).length > 0;
  }

  getComponentsByType(type) {
    return this.components[type] || {};
  }

  toJSON() {
    return {
      openapi: this.openapi,
      info: this.info,
      servers: this.servers,
      tags: this.tags,
      security: this.security,
      externalDocs: this.externalDocs,
      paths: this.paths,
      components: this.components,
      ...this.extensions
    };
  }
}

module.exports = { OpenAPIDocument };