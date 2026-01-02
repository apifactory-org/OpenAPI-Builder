// bin/application/use-cases/ModularizeUseCase.js

const { FilePath } = require("../../domain/value-objects/FilePath");

/**
 * @fileoverview Use Case para modularizar documentos OpenAPI monolíticos.
 * 
 * Este caso de uso implementa el patrón "Build Once, Write Once":
 * 1. Construye un modelo completo en memoria
 * 2. Resuelve todas las referencias sin tocar el filesystem
 * 3. Valida la estructura completa antes de escribir
 * 4. Escribe todos los archivos una sola vez con referencias correctas
 * 
 * Ventajas de esta arquitectura:
 * - Sin correcciones post-escritura
 * - Referencias correctas desde el inicio
 * - Validación antes de I/O
 * - Rollback automático si falla antes de escribir
 * 
 * @module application/use-cases/ModularizeUseCase
 */

/**
 * Caso de Uso: Modularización de documentos OpenAPI
 * 
 * Transforma un documento OpenAPI monolítico en una estructura modular
 * organizada por carpetas y archivos independientes.
 * 
 * @class ModularizeUseCase
 * 
 * @example
 * const useCase = new ModularizeUseCase(
 *   documentRepository,
 *   validator,
 *   logger,
 *   prompter,
 *   nameNormalizer,
 *   responseExtractor,
 *   responseDeduplicator,
 *   parameterExtractor,
 *   modelBuilder,
 *   referenceResolver,
 *   modelValidator,
 *   writer
 * );
 * 
 * await useCase.execute('./api/openapi.yaml', config, { isInteractive: true });
 */
class ModularizeUseCase {
  /**
   * Crea una instancia del caso de uso de modularización.
   * 
   * @param {IDocumentRepository} documentRepository - Repositorio para leer/escribir archivos YAML
   * @param {IValidator} validator - Validador OpenAPI (Redocly)
   * @param {ILogger} logger - Sistema de logging
   * @param {IPrompter} prompter - Sistema de prompts interactivos
   * @param {NameNormalizerService} nameNormalizerService - Servicio de normalización de nombres
   * @param {ResponseExtractorService} responseExtractorService - Extractor de respuestas inline
   * @param {ResponseDeduplicatorService} responseDeduplicatorService - Deduplicador de respuestas
   * @param {ParameterExtractorService} parameterExtractorService - Extractor de parámetros comunes
   * @param {ModularizationModelBuilder} modelBuilder - Constructor del modelo de modularización
   * @param {ReferenceResolver} referenceResolver - Resolvedor de referencias en memoria
   * @param {ModelValidator} modelValidator - Validador del modelo antes de escribir
   * @param {ModularizationWriter} writer - Escritor del modelo al filesystem
   */
  constructor(
    documentRepository,
    validator,
    logger,
    prompter,
    nameNormalizerService,
    responseExtractorService,
    responseDeduplicatorService,
    parameterExtractorService,
    modelBuilder,
    referenceResolver,
    modelValidator,
    writer
  ) {
    this.documentRepo = documentRepository;
    this.validator = validator;
    this.logger = logger;
    this.prompter = prompter;
    this.nameNormalizer = nameNormalizerService;
    this.responseExtractor = responseExtractorService;
    this.responseDeduplicator = responseDeduplicatorService;
    this.parameterExtractor = parameterExtractorService;
    this.modelBuilder = modelBuilder;
    this.referenceResolver = referenceResolver;
    this.modelValidator = modelValidator;
    this.writer = writer;
  }

  /**
   * Ejecuta el proceso de modularización completo.
   * 
   * Flujo de ejecución:
   * 1. Lee el documento OpenAPI monolítico
   * 2. Prepara el directorio de salida
   * 3. Normaliza y extrae componentes (opcional según config)
   * 4. Construye modelo en memoria con referencias correctas
   * 5. Resuelve todas las referencias sin I/O
   * 6. Valida el modelo completo
   * 7. Escribe al filesystem una sola vez
   * 8. Valida con Redocly (opcional según config)
   * 9. Muestra resumen de resultados
   * 
   * @async
   * @param {string} inputPath - Ruta al archivo OpenAPI monolítico
   * @param {Object} config - Configuración de modularización
   * @param {Object} config.paths - Configuración de rutas
   * @param {string} config.paths.modularizedOutput - Directorio de salida
   * @param {Object} config.behavior - Configuración de comportamiento
   * @param {boolean} config.behavior.cleanModularizedOutput - Limpiar salida antes de escribir
   * @param {Object} config.validation - Configuración de validación
   * @param {boolean} config.validation.enabled - Habilitar validación Redocly
   * @param {Object} config.responseNaming - Configuración de naming de respuestas
   * @param {Object} config.naming - Convenciones de nombres
   * @param {Object} config.affixes - Prefijos y sufijos
   * @param {Object} options - Opciones de ejecución
   * @param {boolean} [options.isInteractive=true] - Modo interactivo para prompts
   * 
   * @returns {Promise<void>}
   * 
   * @throws {Error} Si el archivo de entrada no existe
   * @throws {Error} Si el modelo es inválido antes de escribir
   * @throws {Error} Si la validación Redocly falla
   * 
   * @example
   * await useCase.execute(
   *   './api/petstore.yaml',
   *   {
   *     paths: { modularizedOutput: './src' },
   *     behavior: { cleanModularizedOutput: true },
   *     validation: { enabled: true }
   *   },
   *   { isInteractive: true }
   * );
   */
  async execute(inputPath, config, options = {}) {
    const isInteractive = options.isInteractive ?? true;
    this.logger.section("PROCESO DE MODULARIZACIÓN");

    try {
      // ============================================
      // 1. LEER DOCUMENTO
      // ============================================
      this.logger.step(`Leyendo archivo: ${inputPath}`);
      const inputFilePath = new FilePath(inputPath);

      if (!(await this.documentRepo.exists(inputFilePath))) {
        throw new Error(`El archivo no existe: ${inputPath}`);
      }

      const document = await this.documentRepo.read(inputFilePath);
      this.logger.success(`Versión OpenAPI válida: ${document.getVersion()}`);

      // ============================================
      // 2. PREPARAR DIRECTORIO DE SALIDA
      // ============================================
      const outputPath = new FilePath(config.paths.modularizedOutput);
      await this.handleOutputDirectory(outputPath, config, isInteractive);

      // ============================================
      // 3. NORMALIZAR Y EXTRAER (opcional)
      // ============================================
      const normalizedDocument = await this.normalizeExistingResponses(
        document,
        config
      );
      const documentWithExtractedResponses = await this.extractInlineResponses(
        normalizedDocument,
        config
      );
      const documentWithExtractedParams = await this.extractCommonParameters(
        documentWithExtractedResponses,
        config
      );

      // ============================================
      // 4. CONSTRUIR MODELO EN MEMORIA
      // ============================================
      this.logger.section("CONSTRUYENDO MODELO");
      const model = this.modelBuilder.build(documentWithExtractedParams, config);

      // ============================================
      // 5. RESOLVER REFERENCIAS EN MEMORIA
      // ============================================
      this.logger.section("RESOLVIENDO REFERENCIAS");
      this.referenceResolver.resolve(model);

      // ============================================
      // 6. VALIDAR MODELO EN MEMORIA
      // ============================================
      this.logger.section("VALIDANDO MODELO");
      const validationResult = this.modelValidator.validate(model);
      
      if (!validationResult.isValid) {
        throw new Error(
          `Modelo inválido:\n${validationResult.errors.join('\n')}`
        );
      }

      // ============================================
      // 7. ESCRIBIR AL FILESYSTEM (UNA SOLA VEZ)
      // ============================================
      this.logger.section("ESCRIBIENDO ARCHIVOS");
      await this.writer.write(model, outputPath);

      // ============================================
      // 8. VALIDAR CON REDOCLY
      // ============================================
      const validationEnabled = config.validation?.enabled ?? true;
      if (validationEnabled) {
        this.logger.section("VALIDANDO CON REDOCLY");
        const entrypointPath = outputPath.join(model.entrypoint.filePath);
        await this.validator.validate(entrypointPath);
      } else {
        this.logger.section("VALIDACIÓN");
        this.logger.warn("⚠️  Validación deshabilitada en configuración");
      }

      // ============================================
      // 9. MOSTRAR RESUMEN
      // ============================================
      this.showSummary(model, outputPath);
      this.logger.section("✓ MODULARIZACIÓN COMPLETADA");

    } catch (error) {
      this.logger.section("✗ ERROR EN MODULARIZACIÓN");
      this.logger.error("Error al modularizar", error);
      throw error;
    }
  }

  // ============================================
  // MÉTODOS AUXILIARES - GESTIÓN DE SALIDA
  // ============================================

  /**
   * Gestiona el directorio de salida existente.
   * 
   * Si el directorio existe y la configuración indica limpiarlo:
   * - En modo interactivo: solicita confirmación al usuario
   * - En modo no interactivo: limpia automáticamente
   * 
   * @private
   * @async
   * @param {FilePath} outputPath - Ruta del directorio de salida
   * @param {Object} config - Configuración
   * @param {boolean} isInteractive - Modo interactivo
   * @throws {Error} Si el usuario cancela la operación en modo interactivo
   */
  async handleOutputDirectory(outputPath, config, isInteractive) {
    if (await this.documentRepo.exists(outputPath)) {
      if (config.behavior.cleanModularizedOutput) {
        if (isInteractive) {
          const shouldReplace = await this.prompter.confirm(
            `La carpeta ${outputPath} ya existe. ¿Deseas reemplazarla?`,
            false
          );
          if (!shouldReplace) {
            throw new Error("Operación cancelada por el usuario");
          }
        }
        this.logger.step("Limpiando directorio de salida...");
        await this.documentRepo.removeDirectory(outputPath);
      }
    }
  }

  // ============================================
  // MÉTODOS AUXILIARES - NORMALIZACIÓN Y EXTRACCIÓN
  // ============================================

  /**
   * Normaliza nombres de respuestas existentes en components.
   * 
   * Aplica convenciones de naming consistentes a todas las respuestas
   * definidas en el documento original. Solo se ejecuta si está habilitado
   * en la configuración.
   * 
   * @private
   * @async
   * @param {OpenAPIDocument} document - Documento OpenAPI
   * @param {Object} config - Configuración de modularización
   * @returns {Promise<OpenAPIDocument>} Documento con respuestas normalizadas
   * 
   * @example
   * // Antes: "NotFound404", "not-found", "NotFoundError"
   * // Después: "NotFoundResponse", "NotFoundResponse", "NotFoundResponse"
   */
  async normalizeExistingResponses(document, config) {
    const responseConfig = config.responseNaming || { enabled: false };
    if (!responseConfig.enabled) {
      return document;
    }

    this.logger.section("NORMALIZANDO NOMBRES DE RESPUESTAS");
    const responses = document.getComponentsByType("responses");
    const result = this.responseDeduplicator.normalize(responses);

    if (Object.keys(result.nameMapping).length === 0) {
      this.logger.info("Los nombres ya están normalizados");
      return document;
    }

    document.components.responses = result.normalized;
    if (Object.keys(result.refMapping).length > 0) {
      document.paths = this.updateReferences(document.paths, result.refMapping);
    }

    for (const [oldName, newName] of Object.entries(result.nameMapping)) {
      this.logger.step(`${oldName} → ${newName}`);
    }

    this.logger.success(
      `${Object.keys(result.nameMapping).length} nombre(s) normalizado(s)`
    );
    return document;
  }

  /**
   * Extrae respuestas inline de paths a components.
   * 
   * Identifica respuestas definidas directamente en operaciones,
   * las deduplica por estructura y las mueve a components.responses.
   * Reemplaza las definiciones inline con referencias ($ref).
   * 
   * @private
   * @async
   * @param {OpenAPIDocument} document - Documento OpenAPI
   * @param {Object} config - Configuración de modularización
   * @returns {Promise<OpenAPIDocument>} Documento con respuestas extraídas
   * 
   * @example
   * // Antes (inline):
   * // responses:
   * //   200: { description: "OK", content: {...} }
   * 
   * // Después (referencia):
   * // responses:
   * //   200: { $ref: "#/components/responses/SuccessResponse" }
   */
  async extractInlineResponses(document, config) {
    this.logger.section("EXTRAYENDO RESPUESTAS INLINE");
    const result = this.responseExtractor.extract(
      document.paths,
      config.responseNaming || {}
    );

    if (Object.keys(result.extractedResponses).length === 0) {
      this.logger.info("No hay respuestas inline para extraer");
      return document;
    }

    if (!document.components.responses) {
      document.components.responses = {};
    }
    Object.assign(document.components.responses, result.extractedResponses);

    document.paths = this.replaceInlineWithRefs(
      document.paths,
      result.responseReferences,
      config
    );

    let totalRefs = 0;
    for (const methods of Object.values(result.responseReferences)) {
      for (const statuses of Object.values(methods)) {
        totalRefs += Object.keys(statuses).length;
      }
    }

    this.logger.success(
      `${
        Object.keys(result.extractedResponses).length
      } respuesta(s) única(s) extraída(s) ` +
        `(de ${totalRefs} referencias totales - deduplicadas)`
    );

    return document;
  }

  /**
   * Extrae parámetros comunes de paths a components.
   * 
   * Identifica parámetros que se repiten en múltiples operaciones,
   * los deduplica y los mueve a components.parameters organizados
   * por tipo (path, query, header, cookie).
   * 
   * Características:
   * - Deduplicación por clave lógica (in + name)
   * - Validación de path parameters vs placeholders del route
   * - Merge inteligente de definiciones duplicadas
   * - Organización por subcarpetas según tipo
   * 
   * @private
   * @async
   * @param {OpenAPIDocument} document - Documento OpenAPI
   * @param {Object} config - Configuración de modularización
   * @returns {Promise<OpenAPIDocument>} Documento con parámetros extraídos
   * 
   * @example
   * // Antes (inline repetido):
   * // /user/{id}: { parameters: [{ name: "id", in: "path", ... }] }
   * // /pet/{id}:  { parameters: [{ name: "id", in: "path", ... }] }
   * 
   * // Después (componente único):
   * // components:
   * //   parameters:
   * //     path_Id: { name: "id", in: "path", ... }
   */
  async extractCommonParameters(document, config) {
    this.logger.section("EXTRAYENDO PARÁMETROS COMUNES");
    
    const result = this.parameterExtractor.extract(document.paths);

    if (Object.keys(result.extractedParameters).length === 0) {
      this.logger.info("No hay parámetros comunes para extraer");
      return document;
    }

    if (!document.components.parameters) {
      document.components.parameters = {};
    }
    Object.assign(document.components.parameters, result.extractedParameters);

    document.paths = this.replaceInlineParametersWithRefs(
      document.paths,
      result.parameterReferences,
      config
    );

    this.logger.success(
      `${
        Object.keys(result.extractedParameters).length
      } parámetro(s) común(es) extraído(s)`
    );
    return document;
  }

  // ============================================
  // MÉTODOS AUXILIARES - PRESENTACIÓN
  // ============================================

  /**
   * Muestra resumen de la modularización completada.
   * 
   * Presenta estadísticas de:
   * - Carpeta de salida generada
   * - Cantidad de componentes por tipo
   * - Cantidad de paths modularizados
   * 
   * @private
   * @param {ModularizationModel} model - Modelo de modularización
   * @param {FilePath} outputPath - Ruta de salida
   */
  showSummary(model, outputPath) {
    this.logger.section("RESUMEN");
    this.logger.success(`Carpeta generada: ${outputPath}`);

    const stats = model.getStats();
    
    this.logger.info("Componentes modularizados:");
    for (const [type, count] of Object.entries(stats.componentsByType)) {
      this.logger.info(`  - ${type}: ${count} archivo(s)`);
    }
    this.logger.info(`  - paths: ${stats.pathsCount} archivo(s)`);
  }

  // ============================================
  // MÉTODOS AUXILIARES - TRANSFORMACIÓN
  // ============================================

  /**
   * Actualiza referencias en paths según un mapeo.
   * 
   * Reemplaza referencias antiguas por nuevas en todo el objeto paths.
   * Útil después de normalización de nombres.
   * 
   * @private
   * @param {Object} paths - Objeto paths de OpenAPI
   * @param {Object.<string, string>} refMapping - Mapeo oldRef → newRef
   * @returns {Object} Paths con referencias actualizadas
   * 
   * @example
   * updateReferences(paths, {
   *   "#/components/responses/NotFound404": "#/components/responses/NotFoundResponse"
   * })
   */
  updateReferences(paths, refMapping) {
    let pathsStr = JSON.stringify(paths);
    for (const [oldRef, newRef] of Object.entries(refMapping)) {
      const escapedOldRef = oldRef.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      pathsStr = pathsStr.replace(new RegExp(escapedOldRef, "g"), newRef);
    }
    return JSON.parse(pathsStr);
  }

  /**
   * Reemplaza definiciones inline de respuestas con referencias.
   * 
   * Convierte respuestas inline a referencias $ref basándose en el
   * mapeo generado por el extractor de respuestas.
   * 
   * @private
   * @param {Object} paths - Objeto paths de OpenAPI
   * @param {Object} responseReferences - Mapeo de referencias por path/method/status
   * @param {Object} config - Configuración (para extension de archivo)
   * @returns {Object} Paths con respuestas como referencias
   */
  replaceInlineWithRefs(paths, responseReferences, config) {
    const ext = config?.advanced?.fileExtension || ".yaml";

    for (const [pathRoute, methodsMap] of Object.entries(responseReferences)) {
      if (!paths[pathRoute]) continue;

      for (const [method, statusCodesMap] of Object.entries(methodsMap)) {
        if (!paths[pathRoute][method]?.responses) continue;

        for (const [statusCode, responseName] of Object.entries(
          statusCodesMap
        )) {
          paths[pathRoute][method].responses[statusCode] = {
            $ref: `#/components/responses/${responseName}`,
          };
        }
      }
    }
    return paths;
  }

  /**
   * Reemplaza definiciones inline de parámetros con referencias.
   * 
   * Convierte parámetros inline a referencias $ref usando keys compuestas
   * para evitar colisiones entre tipos (ej: "path_Username", "query_Username").
   * 
   * Características:
   * - Usa formato {paramType}_{name} para keys únicas
   * - Soporta parámetros a nivel de path y operación
   * - Preserva la organización por tipo del extractor
   * 
   * @private
   * @param {Object} paths - Objeto paths de OpenAPI
   * @param {Object} parameterReferences - Mapeo de referencias por path
   * @param {Object} parameterReferences[].path - Parámetros a nivel de path
   * @param {Object} parameterReferences[].operations - Parámetros por operación
   * @param {Object} config - Configuración (no usado actualmente)
   * @returns {Object} Paths con parámetros como referencias
   * 
   * @example
   * // Input:
   * // parameters: [{ name: "username", in: "path", ... }]
   * 
   * // Output:
   * // parameters: [{ $ref: "#/components/parameters/path_Username" }]
   */
  replaceInlineParametersWithRefs(paths, parameterReferences, config) {
    for (const [pathRoute, refs] of Object.entries(parameterReferences || {})) {
      if (!paths[pathRoute]) continue;

      if (refs.path && refs.path.length > 0) {
        const pathLevelRefs = refs.path.map(p => ({
          $ref: `#/components/parameters/${p.paramType}_${p.name}`
        }));
        paths[pathRoute].parameters = pathLevelRefs;
      }

      for (const [method, paramInfos] of Object.entries(refs.operations || {})) {
        if (!paths[pathRoute][method]) continue;

        const opRefs = (paramInfos || []).map(p => ({
          $ref: `#/components/parameters/${p.paramType}_${p.name}`
        }));

        if (opRefs.length > 0) {
          paths[pathRoute][method].parameters = opRefs;
        }
      }
    }

    return paths;
  }
}

module.exports = { ModularizeUseCase };