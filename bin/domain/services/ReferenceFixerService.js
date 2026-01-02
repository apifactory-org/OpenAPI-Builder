// bin/domain/services/ReferenceFixerService.js

/**
 * Domain Service: Corrección de referencias $ref después de modularización
 *
 * Responsabilidad (hexagonal):
 * - Normalizar strings $ref a rutas relativas coherentes con la convención de modularización.
 * - Aplicar naming/affixes (reglas de dominio) sin tocar filesystem.
 */
class ReferenceFixerService {
  constructor(nameNormalizerService) {
    this.nameNormalizer = nameNormalizerService;
  }

  /**
   * Corrige referencias en contenido modularizado (deep walk).
   *
   * @param {object|array} content
   * @param {string} componentType  Ej: "paths", "schemas", "responses", ...
   * @param {string} mainFileName   Ej: "main" u "openapi" (sin extensión)
   * @param {object} namingConfig
   * @param {object} affixesConfig
   */
  fixReferences(content, componentType, mainFileName, namingConfig = {}, affixesConfig = {}) {
    if (!content || typeof content !== "object") return content;

    const walk = (node) => {
      if (!node || typeof node !== "object") return node;

      if (Array.isArray(node)) {
        return node.map(walk);
      }

      // Si es un objeto con $ref, intentamos corregirlo
      if (typeof node.$ref === "string") {
        const fixed = this.fixRefString(
          node.$ref,
          componentType,
          mainFileName,
          namingConfig,
          affixesConfig,
          node // contexto (a veces trae info útil)
        );
        return { ...node, $ref: fixed };
      }

      // walk propiedades
      const out = {};
      for (const [k, v] of Object.entries(node)) {
        out[k] = walk(v);
      }
      return out;
    };

    return walk(content);
  }

  /**
   * Corrige un $ref string.
   * Soporta:
   * - #/components/<type>/<name>
   * - ../<mainFile>.yaml#/components/<type>/<name>
   * - deja intacto refs externos (http/https) o archivos ya relativos correctos
   */
  fixRefString(ref, fromType, mainFileName, namingConfig, affixesConfig, contextNode) {
    if (!ref || typeof ref !== "string") return ref;

    // No tocar refs externos
    if (/^(https?:)?\/\//i.test(ref)) return ref;

    // ✅ CORRECCIÓN: Mover este check AL PRINCIPIO
    // Si ya parece ser un path relativo a components CON ESTRUCTURA (file-based), no lo tocamos
    // Esto preserva refs correctas como ../components/parameters/path/UsernameParam.yaml
    if (ref.includes("../components/") || ref.includes("./components/")) {
      return ref;
    }

    // Caso 1: #/components/<type>/<name>
    const m1 = ref.match(/^#\/components\/([^/]+)\/([^/]+)$/);
    if (m1) {
      const [, toType, rawName] = m1;
      return this.buildRelativeComponentRef(
        fromType,
        toType,
        rawName,
        mainFileName,
        namingConfig,
        affixesConfig,
        contextNode
      );
    }

    // Caso 2: ../<main>.yaml#/components/<type>/<name>  (a veces lo generan etapas intermedias)
    const m2 = ref.match(new RegExp(`^\\.\\./${this.escapeRegExp(mainFileName)}\\.ya?ml#\\/components\\/([^/]+)\\/([^/]+)$`));
    if (m2) {
      const [, toType, rawName] = m2;
      return this.buildRelativeComponentRef(
        fromType,
        toType,
        rawName,
        mainFileName,
        namingConfig,
        affixesConfig,
        contextNode
      );
    }

    return ref;
  }

  /**
   * Construye un $ref relativo según tipo origen/destino.
   * Ejemplos:
   * - Desde paths -> ../components/schemas/FooSchema.yaml
   * - Entre schemas -> ./BarSchema.yaml o ../responses/X.yaml etc.
   */
  buildRelativeComponentRef(fromType, toType, rawName, mainFileName, namingConfig, affixesConfig, contextNode) {
    if (!this.isComponentType(toType) && toType !== "schemas") {
      // si no es un tipo conocido, mejor no arriesgar
      return `../${mainFileName}.yaml#/components/${toType}/${rawName}`;
    }

    const ext = ".yaml";

    // PARAMETERS: requieren subcarpeta por tipo (header/query/path/cookie)
    if (toType === "parameters") {
      const folder = this.inferParameterFolder(rawName, contextNode);
      const fileBase = this.buildComponentFileBaseName(rawName, "parameters", namingConfig, affixesConfig);
      if (folder) {
        return this.joinRefPath(this.getRelativePath(fromType, "parameters"), `${folder}/${fileBase}${ext}`);
      }
      // Si no se puede inferir, cae en raíz de parameters (conservador)
      return this.joinRefPath(this.getRelativePath(fromType, "parameters"), `${fileBase}${ext}`);
    }

    // Otros componentes
    const fileBase = this.buildComponentFileBaseName(rawName, toType, namingConfig, affixesConfig);
    return this.joinRefPath(this.getRelativePath(fromType, toType), `${fileBase}${ext}`);
  }

  /**
   * Determina carpeta de parameters usando reglas conservadoras.
   * - prefijo: "header_" "query_" etc.
   * - sufijo: "...Header" "...Query" etc.
   * - (fallback) si contextNode tiene "in"
   */
  inferParameterFolder(rawName, contextNode) {
    const n = String(rawName || "");

    // prefijo tipo query_foo
    if (n.includes("_")) {
      const first = n.split("_")[0].toLowerCase();
      if (["header", "query", "path", "cookie"].includes(first)) return first;
    }

    // sufijos semánticos
    if (/header$/i.test(n)) return "header";
    if (/query$/i.test(n)) return "query";
    if (/path$/i.test(n)) return "path";
    if (/cookie$/i.test(n)) return "cookie";

    // fallback por contexto (si viene inline con in:)
    const inValue = contextNode && typeof contextNode === "object" ? String(contextNode.in || "").toLowerCase() : "";
    if (["header", "query", "path", "cookie"].includes(inValue)) return inValue;

    return null;
  }

  /**
   * Convierte "rawName" a base de archivo respetando naming + sufijos.
   * Para parameters, elimina sufijos semánticos antes de aplicar Param.
   */
  buildComponentFileBaseName(rawName, type, namingConfig, affixesConfig) {
    const convention = namingConfig?.components || "PascalCase";

    let clean = String(rawName || "");

    // Si viene con prefijo "query_Foo" -> "Foo" (nombre lógico)
    if (type === "parameters" && clean.includes("_")) {
      const parts = clean.split("_");
      const first = (parts[0] || "").toLowerCase();
      if (["header", "query", "path", "cookie"].includes(first)) {
        clean = parts.slice(1).join("_");
      }
    }

    // Quitar sufijos semánticos del nombre lógico
    if (type === "parameters") {
      clean = clean.replace(/(Header|Query|Path|Cookie|Param)$/i, "");
    }

    // Para otros tipos, no tocamos el nombre salvo que el proyecto lo haga por affixes
    let fileBase = this.nameNormalizer.applyConvention(clean, convention);

    // Aplicar sufijos configurados (si están habilitados)
    if (affixesConfig?.enabled && affixesConfig?.suffixes?.[type]) {
      fileBase += affixesConfig.suffixes[type];
    }

    return fileBase;
  }

  /**
   * Calcula ruta relativa entre componentes.
   * - desde paths -> ../components/<type>
   * - mismo tipo (no paths) -> .
   * - entre tipos -> ../<toType>
   */
  getRelativePath(fromType, toType) {
    if (fromType === toType) return ".";

    if (fromType === "paths") {
      return `../components/${toType}`;
    }

    return `../${toType}`;
  }

  joinRefPath(base, tail) {
    if (!base || base === ".") return `./${tail}`.replace(/\/{2,}/g, "/");
    return `${base}/${tail}`.replace(/\/{2,}/g, "/");
  }

  escapeRegExp(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  isComponentType(type) {
    const validTypes = [
      "schemas",
      "requestBodies",
      "responses",
      "securitySchemes",
      "parameters",
      "examples",
      "headers",
    ];
    return validTypes.includes(type);
  }
}

module.exports = { ReferenceFixerService };