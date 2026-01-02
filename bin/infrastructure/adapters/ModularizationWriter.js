// bin/infrastructure/adapters/ModularizationWriter.js

const path = require("path");

/**
 * Infrastructure Adapter: Escribe el modelo al filesystem
 *
 * Responsabilidad:
 * - Crear estructura de directorios
 * - Escribir archivos de components
 * - Escribir archivos de paths
 * - Escribir entrypoint
 *
 * NO corrige referencias (ya vienen correctas del modelo)
 */
class ModularizationWriter {
  constructor(documentRepository, logger) {
    this.documentRepo = documentRepository;
    this.logger = logger;
  }

  /**
   * Escribe todo el modelo al filesystem
   */
  async write(model, outputPath) {
    this.logger.info(`Escribiendo modelo en: ${outputPath}`);

    // 1. Crear estructura de directorios
    await this._createDirectoryStructure(outputPath, model);

    // 2. Escribir components
    await this._writeComponents(model, outputPath);

    // 3. Escribir paths
    await this._writePaths(model, outputPath);

    // 4. Escribir entrypoint
    await this._writeEntrypoint(model, outputPath);

    this.logger.success(
      `✓ Escritura completada: ${model.stats.componentsCount} components, ${model.stats.pathsCount} paths`
    );
  }

  /**
   * Crea la estructura de directorios necesaria
   */
  async _createDirectoryStructure(outputPath, model) {
    this.logger.step("Creando estructura de directorios...");

    // Raíz
    await this.documentRepo.ensureDirectory(outputPath);

    // components/
    const componentsDir = outputPath.join("components");
    await this.documentRepo.ensureDirectory(componentsDir);

    // paths/
    await this.documentRepo.ensureDirectory(outputPath.join("paths"));

    // Detectar qué tipos de components existen en el modelo
    const componentTypes = new Set();
    const componentSubTypes = {};

    for (const component of model.getAllComponents()) {
      componentTypes.add(component.type);

      if (component.subType) {
        if (!componentSubTypes[component.type]) {
          componentSubTypes[component.type] = new Set();
        }
        componentSubTypes[component.type].add(component.subType);
      }
    }

    // Crear directorios solo para los tipos que existen
    for (const type of componentTypes) {
      const typeDir = componentsDir.join(type);
      await this.documentRepo.ensureDirectory(typeDir);

      // Crear subdirectorios si existen
      if (componentSubTypes[type]) {
        for (const subType of componentSubTypes[type]) {
          await this.documentRepo.ensureDirectory(typeDir.join(subType));
        }
      }
    }

    this.logger.step(`✓ Directorios creados: ${componentTypes.size} tipos`);
  }

  /**
   * Escribe todos los archivos de components
   */
  async _writeComponents(model, outputPath) {
    const components = model.getAllComponents();

    if (components.length === 0) {
      this.logger.info("No hay components para escribir");
      return;
    }

    this.logger.step(`Escribiendo ${components.length} components...`);

    for (const component of components) {
      const filePath = outputPath.join(component.getRelativePath());

      // ✅ FIX: Desempaquetar wrapper de parámetros
      let contentToWrite = component.content;

      // Si es un parámetro con wrapper { paramType, content }
      if (
        component.type === "parameters" &&
        contentToWrite &&
        typeof contentToWrite === "object" &&
        contentToWrite.paramType &&
        contentToWrite.content
      ) {
        // Desempaquetar: usar solo el content interno
        contentToWrite = contentToWrite.content;
      }

      // Escribir archivo
      await this.documentRepo.writeYaml(filePath, contentToWrite);
    }

    // Log por tipo
    const byType = {};
    components.forEach((c) => {
      byType[c.type] = (byType[c.type] || 0) + 1;
    });

    for (const [type, count] of Object.entries(byType)) {
      this.logger.step(`  ✓ ${type}: ${count} archivo(s)`);
    }
  }

  /**
   * Escribe todos los archivos de paths
   */
  async _writePaths(model, outputPath) {
    const paths = model.getAllPaths();

    if (paths.length === 0) {
      this.logger.warn("No hay paths para escribir");
      return;
    }

    this.logger.step(`Escribiendo ${paths.length} paths...`);

    for (const pathFile of paths) {
      const filePath = outputPath.join(pathFile.getRelativePath());
      const headerComment = pathFile.getHeaderComment();

      // Escribir con header
      await this.documentRepo.writeYamlWithHeader(
        filePath,
        pathFile.content,
        headerComment
      );

      // Log (opcional)
      // this.logger.step(`  ✓ ${pathFile.route}`)
    }

    this.logger.step(`  ✓ paths: ${paths.length} archivo(s)`);
  }

  /**
   * Escribe el archivo entrypoint (main.yaml)
   */
  async _writeEntrypoint(model, outputPath) {
    this.logger.step("Escribiendo entrypoint...");

    const entrypoint = this._buildEntrypointContent(model);
    const filePath = outputPath.join(model.entrypoint.filePath);

    await this.documentRepo.writeYaml(filePath, entrypoint);

    this.logger.step(`  ✓ ${model.entrypoint.filePath}`);
  }

  /**
   * Construye el contenido del entrypoint
   */
  _buildEntrypointContent(model) {
    const entrypoint = {
      openapi: model.entrypoint.openapi,
      info: model.entrypoint.info,
    };

    // Agregar campos opcionales si existen
    if (model.entrypoint.servers) {
      entrypoint.servers = model.entrypoint.servers;
    }

    if (model.entrypoint.tags) {
      entrypoint.tags = model.entrypoint.tags;
    }

    if (model.entrypoint.security) {
      entrypoint.security = model.entrypoint.security;
    }

    if (model.entrypoint.externalDocs) {
      entrypoint.externalDocs = model.entrypoint.externalDocs;
    }

    // Paths como referencias
    entrypoint.paths = this._buildPathsReferences(model);

    // Components: solo securitySchemes en el entrypoint
    const securitySchemes = model.getComponentsByType("securitySchemes");
    if (securitySchemes.length > 0) {
      entrypoint.components = {
        securitySchemes: this._buildSecuritySchemesReferences(securitySchemes),
      };
    }

    // Extensiones (x-*)
    if (model.entrypoint.extensions) {
      Object.assign(entrypoint, model.entrypoint.extensions);
    }

    return entrypoint;
  }

  /**
   * Construye el objeto paths del entrypoint con $ref
   */
  _buildPathsReferences(model) {
    const pathsRefs = {};

    for (const pathFile of model.getAllPaths()) {
      pathsRefs[pathFile.route] = {
        $ref: `./${pathFile.getRelativePath()}`,
      };
    }

    return pathsRefs;
  }

  /**
   * Construye referencias a securitySchemes
   */
  _buildSecuritySchemesReferences(securitySchemes) {
    const refs = {};

    for (const scheme of securitySchemes) {
      refs[scheme.name] = {
        $ref: `./${scheme.getRelativePath()}`,
      };
    }

    return refs;
  }
}

module.exports = { ModularizationWriter };
