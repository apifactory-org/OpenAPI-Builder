// bin/application/modularize.js
const path = require('path');
const chalk = require('chalk');
const prompts = require('prompts');
const crypto = require('crypto');

const { readYamlFile, writeYamlFile } = require('../infrastructure/yamlUtils');
const { removeDirIfExists, ensureDir, fileExists } = require('../infrastructure/fileSystem');
const { slugifyPath } = require('../core/slugifyPath');
const { fixRefs } = require('../core/fixRefs');
const { applyNamingConvention } = require('../core/namingConventions');
const { validateWithRedocly } = require('./validate');
const { loadAllConfigs } = require('../infrastructure/configLoader');

// ---------------------------------------------------------------
// ESTILOS PARA CONSOLA
// ---------------------------------------------------------------
const styles = {
  divider: () => chalk.dim('-'.repeat(70)),
  section: (text) => chalk.bold.cyan(text),
  step: (text) => chalk.cyan('  -> ' + text),
  success: (text) => chalk.green('  OK ' + text),
  warning: (text) => chalk.yellow('  !! ' + text),
  error: (text) => chalk.red('  XX ' + text),
  info: (text) => chalk.blue('  i  ' + text),
};

// ---------------------------------------------------------------------------
// CARGA DE CONFIGURACION
// ---------------------------------------------------------------------------
const configs = loadAllConfigs();
const modularizeConfig = configs.modularize;

if (!modularizeConfig) throw new Error('No existe config/modularize.yaml');
if (!modularizeConfig.paths) throw new Error('FALTA config.modularize.paths');
if (!modularizeConfig.behavior) throw new Error('FALTA config.modularize.behavior');
if (!modularizeConfig.advanced) throw new Error('FALTA config.modularize.advanced');
if (!modularizeConfig.naming) throw new Error('FALTA config.modularize.naming');
if (!modularizeConfig.affixes) throw new Error('FALTA config.modularize.affixes');

const pathsConfig = modularizeConfig.paths;
const behaviorConfig = modularizeConfig.behavior;
const advancedConfig = modularizeConfig.advanced;
const namingConfig = modularizeConfig.naming;
const affixesConfig = modularizeConfig.affixes;

// Configuracion de normalizacion de respuestas
const responseNamingConfig = modularizeConfig.responseNaming || {
  enabled: false,
  removeStatusCodeFromName: true,
  ensureResponseSuffix: true,
  includeStatusCodeInName: false,
  useSemanticNames: true,
  statusNames: {
    200: 'Ok', 201: 'Created', 204: 'NoContent',
    400: 'BadRequest', 401: 'Unauthorized', 403: 'Forbidden',
    404: 'NotFound', 405: 'MethodNotAllowed', 409: 'Conflict',
    422: 'UnprocessableEntity', 429: 'TooManyRequests',
    500: 'InternalServerError', 501: 'NotImplemented',
    502: 'BadGateway', 503: 'ServiceUnavailable', 504: 'GatewayTimeout',
    default: 'UnexpectedError'
  },
  preserveCustomNames: ['2xx']
};

// ---------------------------------------------------------------------------
// VARIABLES DE CONFIGURACION
// ---------------------------------------------------------------------------
const DEFAULT_INPUT = pathsConfig.input;
const TARGET_DIR = pathsConfig.modularizedOutput;
const NORMALIZED_TARGET_DIR = path.normalize(TARGET_DIR);
const COMPONENTS_DIR = path.join(NORMALIZED_TARGET_DIR, 'components');
const PATHS_DIR = path.join(NORMALIZED_TARGET_DIR, 'paths');
const FILE_EXTENSION = advancedConfig.fileExtension;
const MAIN_FILE_NAME = pathsConfig.mainFileName || 'openapi';
const MAIN_FILE = path.join(NORMALIZED_TARGET_DIR, MAIN_FILE_NAME + FILE_EXTENSION);
const CLEAN_MOD_OUTPUT = behaviorConfig.cleanModularizedOutput;
const FIX_REFS = behaviorConfig.fixRefs;

// Descripciones genericas para respuestas
const GENERIC_DESCRIPTIONS = {
  '200': 'Successful operation',
  '201': 'Resource created successfully',
  '202': 'Request accepted',
  '204': 'No content',
  '400': 'Bad request',
  '401': 'Unauthorized',
  '403': 'Forbidden',
  '404': 'Resource not found',
  '405': 'Method not allowed',
  '409': 'Conflict',
  '422': 'Unprocessable entity',
  '429': 'Too many requests',
  '500': 'Internal server error',
  '501': 'Not implemented',
  '502': 'Bad gateway',
  '503': 'Service unavailable',
  '504': 'Gateway timeout',
  'default': 'Unexpected error'
};

// ---------------------------------------------------------------------------
// FUNCIONES AUXILIARES
// ---------------------------------------------------------------------------

function assertValidOpenApiVersion(value) {
  if (typeof value !== 'string' || !/^3\.\d+(\.\d+)?$/.test(value.trim())) {
    throw new Error('Valor invalido para openapi: ' + value);
  }
}

function sanitizeComponentName(text) {
  if (!text) return '';
  return text.trim()
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function hashContent(content) {
  const normalized = JSON.stringify(content, Object.keys(content).sort());
  return crypto.createHash('md5').update(normalized).digest('hex').substring(0, 8);
}

function isSimpleResponse(response) {
  const keys = Object.keys(response || {});
  return keys.length === 0 || (keys.length === 1 && keys[0] === 'description');
}

function getContentSignature(response) {
  if (!response || !response.content) return null;
  const signature = {};
  for (const [mediaType, mediaContent] of Object.entries(response.content)) {
    signature[mediaType] = { schema: mediaContent.schema || null };
  }
  return JSON.stringify(signature, Object.keys(signature).sort());
}

function shouldPreserveCustomName(statusCode) {
  const preserveList = responseNamingConfig.preserveCustomNames || [];
  for (const pattern of preserveList) {
    if (pattern === String(statusCode)) return true;
    if (pattern === '2xx' && statusCode >= 200 && statusCode < 300) return true;
    if (pattern === '4xx' && statusCode >= 400 && statusCode < 500) return true;
    if (pattern === '5xx' && statusCode >= 500 && statusCode < 600) return true;
  }
  return false;
}

function normalizeResponseName(originalName, statusCode, description) {
  if (!responseNamingConfig.enabled) return originalName;

  const numericCode = parseInt(statusCode, 10);
  
  if (!isNaN(numericCode) && shouldPreserveCustomName(numericCode)) {
    let name = originalName;
    if (responseNamingConfig.removeStatusCodeFromName) {
      name = name.replace(/\d{3}$/, '');
    }
    if (responseNamingConfig.ensureResponseSuffix && !name.endsWith('Response')) {
      name = name + 'Response';
    }
    return name;
  }

  let baseName = '';
  if (responseNamingConfig.useSemanticNames) {
    const statusNames = responseNamingConfig.statusNames || {};
    if (statusCode === 'default') {
      baseName = statusNames.default || 'Default';
    } else if (statusNames[statusCode]) {
      baseName = statusNames[statusCode];
    } else if (statusNames[numericCode]) {
      baseName = statusNames[numericCode];
    } else {
      baseName = sanitizeComponentName(description) || originalName;
      if (responseNamingConfig.removeStatusCodeFromName) {
        baseName = baseName.replace(/\d{3}$/, '').replace(/\d{3}/, '');
      }
    }
  } else {
    baseName = originalName;
    if (responseNamingConfig.removeStatusCodeFromName) {
      baseName = baseName.replace(/\d{3}$/, '').replace(/\d{3}/, '');
    }
  }

  baseName = baseName.replace(/Response$/i, '');
  if (responseNamingConfig.ensureResponseSuffix) {
    baseName = baseName + 'Response';
  }
  if (responseNamingConfig.includeStatusCodeInName && statusCode !== 'default') {
    baseName = baseName + statusCode;
  }
  return baseName;
}

function generateResponseNameForInline(statusCode, description, existingNames) {
  const statusNames = responseNamingConfig.statusNames || {};
  let baseName = '';
  if (statusCode === 'default') {
    baseName = statusNames.default || 'Default';
  } else {
    baseName = statusNames[statusCode] || ('Status' + statusCode);
  }

  let finalName = normalizeResponseName(baseName, statusCode, description || '');
  const convention = namingConfig.components || 'PascalCase';
  finalName = applyNamingConvention(finalName, convention);

  let uniqueName = finalName;
  let counter = 1;
  while (existingNames.has(uniqueName)) {
    uniqueName = finalName + counter;
    counter++;
  }
  existingNames.add(uniqueName);
  return uniqueName;
}

function normalizeExistingResponses(components) {
  if (!responseNamingConfig.enabled) {
    return { normalized: {}, nameMapping: {}, refMapping: {} };
  }
  if (!components || !components.responses) {
    return { normalized: {}, nameMapping: {}, refMapping: {} };
  }

  const normalized = {};
  const nameMapping = {};
  const refMapping = {};
  const signatureToName = {};

  for (const [originalName, content] of Object.entries(components.responses)) {
    const codeMatch = originalName.match(/(\d{3})/);
    const statusCode = codeMatch ? codeMatch[1] : 'default';
    const contentSignature = getContentSignature(content);
    const isSimple = isSimpleResponse(content);
    
    let dedupeKey;
    if (isSimple) {
      dedupeKey = 'simple:' + statusCode;
    } else if (contentSignature) {
      dedupeKey = statusCode + ':' + contentSignature;
    } else {
      dedupeKey = 'unique:' + originalName;
    }

    if (signatureToName[dedupeKey]) {
      const existingName = signatureToName[dedupeKey];
      refMapping['#/components/responses/' + originalName] = '#/components/responses/' + existingName;
      nameMapping[originalName] = existingName + ' (deduplicado)';
      continue;
    }

    const newName = normalizeResponseName(originalName, statusCode, content.description || '');
    const convention = namingConfig.components || 'PascalCase';
    const finalName = applyNamingConvention(newName, convention);

    const normalizedContent = Object.assign({}, content);
    if (GENERIC_DESCRIPTIONS[statusCode]) {
      normalizedContent.description = GENERIC_DESCRIPTIONS[statusCode];
    }

    signatureToName[dedupeKey] = finalName;
    normalized[finalName] = normalizedContent;
    
    if (finalName !== originalName) {
      nameMapping[originalName] = finalName;
      refMapping['#/components/responses/' + originalName] = '#/components/responses/' + finalName;
    }
  }

  return { normalized: normalized, nameMapping: nameMapping, refMapping: refMapping };
}

function extractInlineResponses(paths) {
  const extractedResponses = {};
  const responseReferences = {};
  const simpleResponseByCode = {};
  const contentSignatureMap = {};
  const usedNames = new Set();

  for (const [pathRoute, pathObj] of Object.entries(paths || {})) {
    if (!pathObj) continue;

    for (const [method, operation] of Object.entries(pathObj)) {
      const validMethods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace'];
      if (!validMethods.includes(method.toLowerCase())) continue;
      if (!operation || !operation.responses) continue;

      responseReferences[pathRoute] = responseReferences[pathRoute] || {};
      responseReferences[pathRoute][method] = {};

      for (const [statusCode, response] of Object.entries(operation.responses)) {
        if (response.$ref) continue;

        // CASO 1: Respuesta simple
        if (isSimpleResponse(response)) {
          if (simpleResponseByCode[statusCode]) {
            responseReferences[pathRoute][method][statusCode] = simpleResponseByCode[statusCode];
            continue;
          }
          const responseName = generateResponseNameForInline(statusCode, '', usedNames);
          const genericContent = {
            description: GENERIC_DESCRIPTIONS[statusCode] || ('Response for status ' + statusCode)
          };
          simpleResponseByCode[statusCode] = responseName;
          extractedResponses[responseName] = genericContent;
          responseReferences[pathRoute][method][statusCode] = responseName;
          continue;
        }

        // CASO 2: Respuesta con content
        const contentSignature = getContentSignature(response);
        if (contentSignature) {
          const signatureKey = statusCode + ':' + contentSignature;
          if (contentSignatureMap[signatureKey]) {
            responseReferences[pathRoute][method][statusCode] = contentSignatureMap[signatureKey];
            continue;
          }
          const responseName = generateResponseNameForInline(statusCode, '', usedNames);
          const normalizedResponse = {
            description: GENERIC_DESCRIPTIONS[statusCode] || response.description || ('Response for status ' + statusCode),
            content: response.content
          };
          if (response.headers) {
            normalizedResponse.headers = response.headers;
          }
          contentSignatureMap[signatureKey] = responseName;
          extractedResponses[responseName] = normalizedResponse;
          responseReferences[pathRoute][method][statusCode] = responseName;
          continue;
        }

        // CASO 3: Respuesta compleja unica
        const contentHash = hashContent(response);
        const hashKey = 'hash:' + contentHash;
        if (contentSignatureMap[hashKey]) {
          responseReferences[pathRoute][method][statusCode] = contentSignatureMap[hashKey];
          continue;
        }
        const responseName = generateResponseNameForInline(statusCode, response.description, usedNames);
        contentSignatureMap[hashKey] = responseName;
        extractedResponses[responseName] = response;
        responseReferences[pathRoute][method][statusCode] = responseName;
      }
    }
  }

  return { extractedResponses: extractedResponses, responseReferences: responseReferences };
}

function replaceInlineResponsesWithRefs(paths, responseReferences) {
  for (const [pathRoute, methodsMap] of Object.entries(responseReferences)) {
    if (!paths[pathRoute]) continue;
    for (const [method, statusCodesMap] of Object.entries(methodsMap)) {
      if (!paths[pathRoute][method] || !paths[pathRoute][method].responses) continue;
      for (const [statusCode, responseName] of Object.entries(statusCodesMap)) {
        paths[pathRoute][method].responses[statusCode] = {
          $ref: '../components/responses/' + responseName + '.yaml'
        };
      }
    }
  }
}

function generateFileName(itemName, componentType) {
  let fileName = itemName;
  const convention = namingConfig.components || 'PascalCase';
  fileName = applyNamingConvention(fileName, convention);
  if (affixesConfig.enabled) {
    const prefix = (affixesConfig.prefixes && affixesConfig.prefixes[componentType]) || '';
    const suffix = (affixesConfig.suffixes && affixesConfig.suffixes[componentType]) || '';
    if (prefix) fileName = prefix + fileName;
    if (suffix) fileName = fileName + suffix;
  }
  return fileName;
}

// ---------------------------------------------------------------------------
// LOGICA PRINCIPAL
// ---------------------------------------------------------------------------

async function modularize(inputPathFromCli) {
  const inputPath = inputPathFromCli || DEFAULT_INPUT;

  console.log('\n' + styles.divider());
  console.log(styles.section('  PROCESO DE MODULARIZACION'));
  console.log(styles.divider());

  try {
    console.log(styles.step('Leyendo archivo: ' + inputPath));

    if (!fileExists(inputPath)) {
      throw new Error('El archivo de entrada no existe: ' + inputPath);
    }

    const oasData = readYamlFile(inputPath);
    assertValidOpenApiVersion(oasData.openapi);
    console.log(styles.success('Version OpenAPI valida: ' + oasData.openapi));

    if (fileExists(NORMALIZED_TARGET_DIR) && CLEAN_MOD_OUTPUT) {
      console.log('');
      const response = await prompts({
        type: 'confirm',
        name: 'replace',
        message: 'La carpeta ' + NORMALIZED_TARGET_DIR + ' ya existe. Deseas reemplazarla?',
        initial: false,
      });
      if (!response.replace) {
        console.log(styles.warning('Operacion cancelada por el usuario'));
        return;
      }
    }

    if (CLEAN_MOD_OUTPUT) {
      console.log(styles.step('Limpiando directorio de salida...'));
      removeDirIfExists(NORMALIZED_TARGET_DIR);
    }

    console.log(styles.step('Creando estructura de directorios...'));
    ensureDir(COMPONENTS_DIR);
    ensureDir(PATHS_DIR);
    console.log(styles.success('Directorios listos en: ' + NORMALIZED_TARGET_DIR));

    const newOas = {
      openapi: oasData.openapi,
      info: oasData.info,
      servers: oasData.servers || [],
      tags: oasData.tags || [],
      security: oasData.security || [],
      externalDocs: oasData.externalDocs || undefined,
      paths: {},
      components: {},
    };

    Object.entries(oasData).forEach(function(entry) {
      if (entry[0].startsWith('x-')) newOas[entry[0]] = entry[1];
    });

    // Normalizar respuestas existentes
    if (responseNamingConfig.enabled && oasData.components && oasData.components.responses) {
      console.log('\n' + styles.section('  NORMALIZANDO NOMBRES DE RESPUESTAS'));
      
      const result = normalizeExistingResponses(oasData.components);
      const normalized = result.normalized;
      const nameMapping = result.nameMapping;
      const refMapping = result.refMapping;
      
      const changesCount = Object.keys(nameMapping).length;
      
      if (changesCount > 0) {
        oasData.components.responses = normalized;
        
        if (Object.keys(refMapping).length > 0) {
          let pathsStr = JSON.stringify(oasData.paths);
          for (const [oldRef, newRef] of Object.entries(refMapping)) {
            const escapedOldRef = oldRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            pathsStr = pathsStr.replace(new RegExp(escapedOldRef, 'g'), newRef);
          }
          oasData.paths = JSON.parse(pathsStr);
        }
        
        for (const [oldName, newName] of Object.entries(nameMapping)) {
          console.log(styles.step('  ' + oldName + ' -> ' + newName));
        }
        console.log(styles.success(changesCount + ' nombre(s) procesado(s)'));
      } else {
        console.log(styles.info('Los nombres ya estan normalizados'));
      }
    }

    // Extraer respuestas inline
    console.log('\n' + styles.section('  EXTRAYENDO RESPUESTAS INLINE'));

    const extractResult = extractInlineResponses(oasData.paths);
    const extractedResponses = extractResult.extractedResponses;
    const responseReferences = extractResult.responseReferences;

    if (Object.keys(extractedResponses).length > 0) {
      if (!oasData.components) oasData.components = {};
      if (!oasData.components.responses) oasData.components.responses = {};

      Object.assign(oasData.components.responses, extractedResponses);
      replaceInlineResponsesWithRefs(oasData.paths, responseReferences);

      let totalRefs = 0;
      for (const methods of Object.values(responseReferences)) {
        for (const statuses of Object.values(methods)) {
          totalRefs += Object.keys(statuses).length;
        }
      }

      console.log(styles.success(
        Object.keys(extractedResponses).length + ' respuesta(s) unica(s) extraida(s) ' +
        '(de ' + totalRefs + ' referencias totales - deduplicadas)'
      ));
    } else {
      console.log(styles.info('No hay respuestas inline para extraer'));
    }

    // Modularizar components
    console.log('\n' + styles.section('  DESCOMPONIENDO COMPONENTS'));

    const components = oasData.components || {};
    let componentCount = 0;
    const componentsByType = {};

    const standardComponentTypes = [
      'schemas', 'responses', 'requestBodies', 'parameters',
      'examples', 'headers', 'securitySchemes'
    ];

    standardComponentTypes.forEach(function(type) {
      const categoryDir = path.join(COMPONENTS_DIR, type);
      ensureDir(categoryDir);
      componentsByType[type] = [];
    });

    for (const [categoryKey, categoryContent] of Object.entries(components)) {
      if (categoryContent && Object.keys(categoryContent).length > 0) {
        const categoryDir = path.join(COMPONENTS_DIR, categoryKey);
        ensureDir(categoryDir);

        console.log(styles.step('Procesando ' + categoryKey + ':'));

        if (!componentsByType[categoryKey]) {
          componentsByType[categoryKey] = [];
        }

        for (const [itemName, itemContent] of Object.entries(categoryContent)) {
          let fileName;
          if (categoryKey === 'responses') {
            fileName = itemName;
          } else {
            fileName = generateFileName(itemName, categoryKey);
          }

          const fileNameWithExt = fileName + FILE_EXTENSION;
          const filePath = path.join(categoryDir, fileNameWithExt);

          let finalContent = itemContent;
          if (FIX_REFS) {
            finalContent = fixRefs(itemContent, categoryKey, MAIN_FILE_NAME, namingConfig, affixesConfig);
          }
          writeYamlFile(filePath, finalContent);

          if (!newOas.components[categoryKey]) {
            newOas.components[categoryKey] = {};
          }
          newOas.components[categoryKey][itemName] = {
            $ref: './components/' + categoryKey + '/' + fileNameWithExt
          };

          componentsByType[categoryKey].push(itemName);
          componentCount++;
          console.log(styles.step('  -> ' + itemName + ' -> ' + fileNameWithExt));
        }
      }
    }

    if (componentCount === 0) {
      console.log(styles.warning('No se encontraron components para modularizar'));
    } else {
      console.log(styles.success(componentCount + ' component(s) modularizado(s)'));
    }

    // Modularizar paths
    console.log('\n' + styles.section('  DESCOMPONIENDO PATHS'));

    const originalPaths = oasData.paths || {};
    let pathCount = 0;
    let ignoredCount = 0;
    const pathsList = [];

    for (const [route, pathObj] of Object.entries(originalPaths)) {
      if (pathObj && Object.keys(pathObj).length > 0) {
        const routeSlugified = slugifyPath(route).replace(/\.yaml$/, '');
        const pathConvention = namingConfig.paths || 'kebab-case';
        const fileName = applyNamingConvention(routeSlugified, pathConvention) + FILE_EXTENSION;
        const filePath = path.join(PATHS_DIR, fileName);

        let finalPathObj = pathObj;
        if (FIX_REFS) {
          finalPathObj = fixRefs(pathObj, 'paths', MAIN_FILE_NAME, namingConfig, affixesConfig);
        }
        writeYamlFile(filePath, finalPathObj);

        newOas.paths[route] = { $ref: './paths/' + fileName };
        pathCount++;
        pathsList.push(route);
        console.log(styles.step('Ruta: ' + route + ' -> ' + fileName));
      } else {
        ignoredCount++;
        console.log(styles.warning('Ruta vacia ignorada: ' + route));
      }
    }

    if (pathCount === 0) {
      throw new Error('No se encontraron paths validos para modularizar');
    }
    console.log(styles.success(pathCount + ' path(s) modularizado(s), ' + ignoredCount + ' ignorado(s)'));

    // Guardar entrypoint
    console.log('\n' + styles.section('  GUARDANDO ENTRYPOINT'));
    writeYamlFile(MAIN_FILE, newOas);
    console.log(styles.step('Archivo principal: ' + path.basename(MAIN_FILE)));

    // Validar con Redocly
    console.log('\n' + styles.section('  VALIDANDO CON REDOCLY'));
    await validateWithRedocly(MAIN_FILE);

    // Resumen
    console.log('\n' + styles.divider());
    console.log(chalk.green.bold('  MODULARIZACION COMPLETADA'));
    console.log(styles.divider());
    console.log(styles.success('Carpeta generada: ' + NORMALIZED_TARGET_DIR));

    const activeTypes = Object.keys(componentsByType).filter(function(t) {
      return componentsByType[t].length > 0;
    });
    
    console.log(styles.info('Resumen:'));
    activeTypes.forEach(function(type) {
      console.log(styles.info('  - ' + type + ': ' + componentsByType[type].length + ' archivo(s)'));
    });
    console.log(styles.info('  - paths: ' + pathsList.length + ' archivo(s)'));
    console.log('');

  } catch (error) {
    console.log('\n' + styles.divider());
    console.log(chalk.red.bold('  ERROR EN MODULARIZACION'));
    console.log(styles.divider());
    console.log(styles.error(error.message));
    console.log('');
    throw error;
  }
}

module.exports = {
  modularize: modularize,
  TARGET_DIR: NORMALIZED_TARGET_DIR,
  COMPONENTS_DIR: COMPONENTS_DIR,
  PATHS_DIR: PATHS_DIR,
  MAIN_FILE: MAIN_FILE,
};