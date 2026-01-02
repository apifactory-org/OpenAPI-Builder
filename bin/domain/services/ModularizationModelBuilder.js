// bin/domain/services/ModularizationModelBuilder.js

const { ModularizationModel } = require('../entities/ModularizationModel')
const { ComponentFile } = require('../entities/ComponentFile')
const { PathFile } = require('../entities/PathFile')

/**
 * Domain Service: Construye el ModularizationModel desde un OpenAPIDocument
 * 
 * Responsabilidad:
 * - Convertir components y paths del documento a entidades ComponentFile/PathFile
 * - Determinar subTypes correctamente (path/query/header/cookie, model/enum/error)
 * - Insertar referencias correctas desde el inicio
 */
class ModularizationModelBuilder {
  constructor(nameNormalizerService, logger) {
    this.nameNormalizer = nameNormalizerService
    this.logger = logger
  }

  /**
   * Construye el modelo completo desde un documento
   */
  build(document, config) {
    const model = new ModularizationModel()
    
    this.logger.info("Extrayendo components...")
    this._extractComponents(document, model, config)
    
    this.logger.info("Extrayendo paths...")
    this._extractPaths(document, model, config)
    
    this.logger.info("Construyendo entrypoint...")
    this._buildEntrypoint(document, model, config)
    
    this.logger.success(`Modelo construido: ${model.stats.componentsCount} components, ${model.stats.pathsCount} paths`)
    
    return model
  }

  _extractComponents(document, model, config) {
    if (!document.components) return
    
    for (const [type, items] of Object.entries(document.components)) {
      if (!items || typeof items !== 'object') continue
      
      for (const [name, content] of Object.entries(items)) {
        const subType = this._determineSubType(type, name, content, config)
        const componentFile = new ComponentFile(name, type, subType, content, config)
        model.addComponent(componentFile)
        this.logger.step(`-> ${name} -> ${componentFile.getRelativePath()}`)
      }
    }
  }

  _determineSubType(type, name, content, config) {
    if (type === 'parameters') {
      return this._determineParameterSubType(name, content)
    }
    
    if (type === 'schemas') {
      return this._determineSchemaSubType(name, content, config)
    }
    
    return null
  }

  _determineParameterSubType(name, content) {
    if (content && typeof content === 'object' && content.paramType) {
      const normalized = this._normalizeParamType(content.paramType)
      if (normalized) return normalized
    }
    
    if (content && typeof content === 'object' && content.in) {
      const normalized = this._normalizeParamType(content.in)
      if (normalized) return normalized
    }
    
    if (content && typeof content === 'object' && content.content && content.content.in) {
      const normalized = this._normalizeParamType(content.content.in)
      if (normalized) return normalized
    }
    
    const nameLower = String(name).toLowerCase()
    
    if (nameLower.includes('_')) {
      const prefix = nameLower.split('_')[0]
      const normalized = this._normalizeParamType(prefix)
      if (normalized) return normalized
    }
    
    if (nameLower.endsWith('header')) return 'header'
    if (nameLower.endsWith('query')) return 'query'
    if (nameLower.endsWith('path')) return 'path'
    if (nameLower.endsWith('cookie')) return 'cookie'
    
    return 'query'
  }

  _determineSchemaSubType(name, content, config) {
    if (!config.modularizeSchemas || !config.modularizeSchemas.enabled) return null
    
    const buckets = config.modularizeSchemas.buckets || {
      enum: 'enum',
      model: 'model',
      value: 'value',
      error: 'error'
    }
    
    if (this._isErrorSchema(name, content, config)) {
      return buckets.error
    }
    
    if (this._isEnum(content)) {
      return buckets.enum
    }
    
    if (this._isObjectLikeSchema(content)) {
      return buckets.model
    }
    
    return buckets.value
  }

  _isErrorSchema(name, schema, config) {
    if (schema && typeof schema === 'object' && schema['x-error'] === true) {
      return true
    }
    
    const patterns = config.modularizeSchemas && config.modularizeSchemas.errorNamePatterns 
      ? config.modularizeSchemas.errorNamePatterns
      : ['error', 'exception', 'fault', 'problem', 'apierror', 'apiexception']
    
    const nameLower = String(name).toLowerCase()
    return patterns.some(pattern => nameLower.includes(pattern.toLowerCase()))
  }

  _isEnum(schema) {
    return schema &&
           typeof schema === 'object' &&
           Array.isArray(schema.enum) &&
           schema.type === 'string'
  }

  _isObjectLikeSchema(schema) {
    if (!schema || typeof schema !== 'object') return false
    
    const type = String(schema.type || '').toLowerCase()
    if (type === 'object') return true
    
    if (schema.properties && typeof schema.properties === 'object') return true
    if (Array.isArray(schema.allOf) || Array.isArray(schema.oneOf) || Array.isArray(schema.anyOf)) return true
    
    return false
  }

  _normalizeParamType(value) {
    const normalized = String(value || '').toLowerCase().trim()
    if (['path', 'query', 'header', 'cookie'].includes(normalized)) {
      return normalized
    }
    return null
  }

  _extractPaths(document, model, config) {
    if (!document.paths) return
    
    for (const [route, pathObj] of Object.entries(document.paths)) {
      if (!pathObj || typeof pathObj !== 'object') continue
      
      const processedContent = this._processPathContent(route, pathObj, model, config)
      const pathFile = new PathFile(route, processedContent, config)
      model.addPath(pathFile)
      this.logger.step(`-> ${route} -> ${pathFile.getRelativePath()}`)
    }
  }

  _processPathContent(route, pathObj, model, config) {
    const processed = this._deepClone(pathObj)
    const routeParams = this._extractPathParams(route)
    
    if (Array.isArray(processed.parameters)) {
      processed.parameters = this._processParameters(processed.parameters, routeParams, model, config)
    }
    
    const validMethods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace']
    
    for (const method of validMethods) {
      if (!processed[method] || typeof processed[method] !== 'object') continue
      
      if (Array.isArray(processed[method].parameters)) {
        processed[method].parameters = this._processParameters(
          processed[method].parameters,
          routeParams,
          model,
          config
        )
      }
      
      if (Array.isArray(processed.parameters) && processed.parameters.length > 0) {
        const pathLevelParams = processed.parameters.filter(p => 
          p.$ref && p.$ref.includes('/path/')
        )
        
        if (pathLevelParams.length > 0) {
          if (!processed[method].parameters) {
            processed[method].parameters = []
          }
          
          processed[method].parameters = this._mergeUniqueRefs(
            processed[method].parameters,
            pathLevelParams
          )
        }
      }
    }
    
    return processed
  }

  _processParameters(parameters, routeParams, model, config) {
    return parameters.map(param => {
      if (param.$ref) return param
      
      if (param.name) {
        const paramName = String(param.name)
        const paramNameLower = paramName.toLowerCase()
        
        let paramType = param.in || 'query'
        
        if (routeParams.includes(paramNameLower)) {
          paramType = 'path'
        }
        
        const componentFile = model.findComponent('parameters', paramType, paramName)
        
        if (componentFile) {
          return { $ref: componentFile.getRelativePathFrom('paths') }
        }
      }
      
      return param
    })
  }

  _mergeUniqueRefs(base, extra) {
    const seen = new Set(base.map(p => p.$ref).filter(Boolean))
    const merged = [...base]
    
    for (const param of extra) {
      if (param.$ref && !seen.has(param.$ref)) {
        merged.push(param)
        seen.add(param.$ref)
      }
    }
    
    return merged
  }

  _extractPathParams(route) {
    const params = []
    const regex = /\{([^}]+)\}/g
    let match
    
    while ((match = regex.exec(route)) !== null) {
      params.push(match[1].toLowerCase())
    }
    
    return params
  }

  _buildEntrypoint(document, model, config) {
    const mainFileName = config.paths && config.paths.mainFileName ? config.paths.mainFileName : 'main'
    const ext = config.advanced && config.advanced.fileExtension ? config.advanced.fileExtension : '.yaml'
    
    model.setEntrypoint({
      openapi: document.openapi,
      info: document.info,
      servers: document.servers,
      tags: document.tags,
      security: document.security,
      externalDocs: document.externalDocs,
      extensions: document.extensions || {},
      filePath: `${mainFileName}${ext}`
    })
  }

  _deepClone(obj) {
    return JSON.parse(JSON.stringify(obj))
  }
}

module.exports = { ModularizationModelBuilder }