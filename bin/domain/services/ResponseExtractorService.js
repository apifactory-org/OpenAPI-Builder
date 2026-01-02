// bin/domain/services/ResponseExtractorService.js

const crypto = require('crypto');

/**
 * Domain Service: Extracción de respuestas según configuración
 * TODO está basado en config, NADA hardcodeado
 */
class ResponseExtractorService {
  constructor() {
    this.extractedResponses = {};
    this.responseReferences = {};
  }

  /**
   * Extrae respuestas según config.responseNaming
   */
  extract(paths, responseNamingConfig = {}) {
    this.extractedResponses = {};
    this.responseReferences = {};

    if (!paths || typeof paths !== 'object') {
      return {
        extractedResponses: {},
        responseReferences: {}
      };
    }

    // Mapas para deduplicación
    const simpleResponseByCode = {};
    const contentSignatureMap = {};
    const usedNames = new Set();

    // Procesar cada path
    for (const [pathRoute, pathItem] of Object.entries(paths)) {
      if (!pathItem || typeof pathItem !== 'object') continue;

      this.responseReferences[pathRoute] = {};

      // Procesar cada método HTTP
      for (const [method, operation] of Object.entries(pathItem)) {
        const validMethods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace'];
        if (!validMethods.includes(method.toLowerCase())) continue;
        
        if (!operation || !operation.responses) continue;

        this.responseReferences[pathRoute][method] = {};

        // Procesar cada respuesta
        for (const [statusCode, response] of Object.entries(operation.responses)) {
          // Skip si ya es una referencia
          if (response.$ref) continue;

          // Verificar si debe extraerse según config
          if (!this.shouldExtractResponse(statusCode, responseNamingConfig)) {
            continue;
          }

          // Deduplicar por contenido
          const responseName = this.getOrCreateResponse(
            statusCode,
            response,
            responseNamingConfig,
            simpleResponseByCode,
            contentSignatureMap,
            usedNames
          );

          // Guardar referencia para reemplazar después
          this.responseReferences[pathRoute][method][statusCode] = responseName;
        }
      }
    }

    return {
      extractedResponses: this.extractedResponses,
      responseReferences: this.responseReferences
    };
  }

  /**
   * Determina si una respuesta debe extraerse según preserveCustomNames
   */
  shouldExtractResponse(statusCode, config) {
    const preserveList = config.preserveCustomNames || [];
    
    const code = parseInt(statusCode, 10);
    
    for (const pattern of preserveList) {
      if (pattern === String(statusCode)) {
        return false;
      }
      
      if (!isNaN(code)) {
        if (pattern === '2xx' && code >= 200 && code < 300) return false;
        if (pattern === '4xx' && code >= 400 && code < 500) return false;
        if (pattern === '5xx' && code >= 500 && code < 600) return false;
      }
    }
    
    return true;
  }

  /**
   * Obtiene o crea una respuesta (deduplicando)
   */
  getOrCreateResponse(
    statusCode,
    response,
    config,
    simpleResponseByCode,
    contentSignatureMap,
    usedNames
  ) {
    // CASO 1: Respuesta simple (solo description)
    if (this.isSimpleResponse(response)) {
      if (simpleResponseByCode[statusCode]) {
        return simpleResponseByCode[statusCode];
      }
      
      const responseName = this.generateResponseName(statusCode, '', config, usedNames);
      
      // ✅ Descripción desde config o la original
      const description = response.description || this.getDescriptionFromConfig(statusCode, config);
      const genericContent = { description };
      
      simpleResponseByCode[statusCode] = responseName;
      this.extractedResponses[responseName] = genericContent;
      return responseName;
    }

    // CASO 2: Respuesta con content (deduplicar por signature)
    const contentSignature = this.getContentSignature(response);
    if (contentSignature) {
      const signatureKey = statusCode + ':' + contentSignature;
      
      if (contentSignatureMap[signatureKey]) {
        return contentSignatureMap[signatureKey];
      }
      
      const responseName = this.generateResponseName(statusCode, '', config, usedNames);
      
      // ✅ Descripción desde config o la original
      const description = response.description || this.getDescriptionFromConfig(statusCode, config);
      
      const normalizedResponse = {
        description,
        content: response.content
      };
      
      if (response.headers) {
        normalizedResponse.headers = response.headers;
      }
      
      contentSignatureMap[signatureKey] = responseName;
      this.extractedResponses[responseName] = normalizedResponse;
      return responseName;
    }

    // CASO 3: Respuesta compleja única
    const contentHash = this.hashContent(response);
    const hashKey = 'hash:' + contentHash;
    
    if (contentSignatureMap[hashKey]) {
      return contentSignatureMap[hashKey];
    }
    
    const responseName = this.generateResponseName(
      statusCode,
      response.description,
      config,
      usedNames
    );
    
    contentSignatureMap[hashKey] = responseName;
    this.extractedResponses[responseName] = response;
    return responseName;
  }

  /**
   * Genera nombre para respuesta DESDE CONFIG
   */
  generateResponseName(statusCode, description, config = {}, usedNames = new Set()) {
    const enabled = config.enabled ?? true;
    const statusNames = config.statusNames || {};
    
    let baseName = '';
    
    // ✅ Usar statusNames del config
    if (enabled && statusNames[statusCode]) {
      baseName = statusNames[statusCode];
    } else if (statusCode === 'default' && statusNames.default) {
      baseName = statusNames.default;
    } else {
      // Fallback si no está en config
      baseName = 'Status' + statusCode;
    }

    // Asegurar sufijo "Response"
    const ensureSuffix = config.ensureResponseSuffix ?? true;
    let finalName = baseName;
    
    if (ensureSuffix && !finalName.endsWith('Response')) {
      finalName = `${finalName}Response`;
    }

    // Asegurar nombre único
    let uniqueName = finalName;
    let counter = 1;
    while (usedNames.has(uniqueName)) {
      uniqueName = `${finalName}${counter}`;
      counter++;
    }
    
    usedNames.add(uniqueName);
    return uniqueName;
  }

  /**
   * Obtiene descripción DESDE CONFIG statusNames
   */
  getDescriptionFromConfig(statusCode, config) {
    const statusNames = config.statusNames || {};
    
    // Convertir nombre a descripción
    // "BadRequest" → "Bad request"
    // "NotFound" → "Not found"
    let name = statusNames[statusCode] || statusNames.default || 'Unexpected error';
    
    // Convertir PascalCase a words
    const words = name.replace(/([A-Z])/g, ' $1').trim().toLowerCase();
    return words.charAt(0).toUpperCase() + words.slice(1);
  }

  /**
   * Verifica si es una respuesta simple (solo description)
   */
  isSimpleResponse(response) {
    if (!response) return true;
    const keys = Object.keys(response);
    return keys.length === 0 || (keys.length === 1 && keys[0] === 'description');
  }

  /**
   * Obtiene signature del content para deduplicación
   */
  getContentSignature(response) {
    if (!response || !response.content) return null;
    
    const signature = {};
    for (const [mediaType, mediaContent] of Object.entries(response.content)) {
      signature[mediaType] = { schema: mediaContent.schema || null };
    }
    
    return JSON.stringify(signature, Object.keys(signature).sort());
  }

  /**
   * Genera hash del contenido
   */
  hashContent(content) {
    const normalized = JSON.stringify(content, Object.keys(content).sort());
    return crypto.createHash('md5').update(normalized).digest('hex').substring(0, 8);
  }
}

module.exports = { ResponseExtractorService };