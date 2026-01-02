// bin/domain/services/ParameterExtractorService.js

const crypto = require("crypto");

/**
 * Domain Service: Extracción de parámetros comunes de paths
 * Organiza parámetros por tipo (path/query/header/cookie)
 *
 * CORRECCIONES:
 * 1) Deduplicación por clave lógica (in + name), NO por “firma completa”.
 *    Evita generar Username, Username1, Username2...
 * 2) Merge defensivo cuando hay varias definiciones del mismo parámetro.
 * 3) Validación conservadora para path params: solo se permiten si el path
 *    realmente contiene {param.name}. (evita refs inválidas tipo /user/login -> in:path username)
 */
class ParameterExtractorService {
  constructor() {
    this.extractedParameters = {};
    this.parameterReferences = {};
  }

  /**
   * Extrae parámetros comunes (path/query/header/cookie) que se repiten
   */
  extract(paths) {
    this.extractedParameters = {};
    this.parameterReferences = {};

    if (!paths || typeof paths !== "object") {
      return {
        extractedParameters: {},
        parameterReferences: {},
      };
    }

    /**
     * Mapa por clave lógica:
     *   logicalKey = `${paramType}:${lower(name)}`
     * value:
     *   { name, paramType, key, content }
     */
    const logicalMap = {};

    const usedNamesByType = {
      path: new Set(),
      query: new Set(),
      header: new Set(),
      cookie: new Set(),
    };

    // PASO 1: Recolectar TODOS los parámetros inline (sin $ref), incluyendo repetidos
    const allParameters = this.collectAllParametersWithContext(paths);

    for (const item of allParameters) {
      const { param, pathRoute } = item || {};
      if (!param || typeof param !== "object") continue;
      if (param.$ref) continue;

      const paramType = this.normalizeParamType(param.in);
      if (!paramType) continue;

      // ✅ Path params: deben existir en el template del path
      if (paramType === "path") {
        const pname = String(param.name || "").trim();
        if (!pname) continue;
        if (!this.pathHasPlaceholder(pathRoute, pname)) {
          // Conservador: NO extraemos ni referenciamos un path param inválido para ese path
          // (evita que luego termine como componente path y rompa validación)
          continue;
        }
      }

      const logicalKey = this.getLogicalKey(param, paramType);

      if (!logicalMap[logicalKey]) {
        const paramName = this.generateParameterName(
          param,
          usedNamesByType[paramType]
        );

        // ✅ Key compuesta para evitar colisiones entre tipos
        const key = `${paramType}_${paramName}`;

        logicalMap[logicalKey] = {
          name: paramName,
          paramType,
          key,
          content: this.cloneDeep(param),
        };

        // Guardar con wrapper (esto lo consume el ComponentSplitterService)
        this.extractedParameters[key] = {
          paramType,
          content: logicalMap[logicalKey].content,
        };
      } else {
        // ✅ Merge: mismo (in + name). Consolidar definición.
        const existing = logicalMap[logicalKey];
        const merged = this.mergeParameter(existing.content, param, existing.paramType);

        existing.content = merged;
        // actualizar wrapper
        this.extractedParameters[existing.key] = {
          paramType: existing.paramType,
          content: existing.content,
        };
      }
    }

    // PASO 2: Crear referencias (por cada aparición inline en paths/ops)
    this.createReferences(paths, logicalMap);

    return {
      extractedParameters: this.extractedParameters,
      parameterReferences: this.parameterReferences,
    };
  }

  /**
   * Recolecta todos los parámetros inline (sin $ref) de todos los paths,
   * incluyendo repetidos (para poder detectar "comunes" aguas abajo).
   *
   * Devuelve además el contexto (pathRoute) para validar path params.
   */
  collectAllParametersWithContext(paths) {
    const parameters = [];
    const validMethods = [
      "get",
      "post",
      "put",
      "delete",
      "patch",
      "options",
      "head",
      "trace",
    ];

    for (const [pathRoute, pathItem] of Object.entries(paths)) {
      if (!pathItem || typeof pathItem !== "object") continue;

      // Parámetros a nivel de path
      if (Array.isArray(pathItem.parameters)) {
        for (const param of pathItem.parameters) {
          if (param && typeof param === "object" && !param.$ref) {
            parameters.push({ param, pathRoute, level: "path" });
          }
        }
      }

      // Parámetros a nivel de operación
      for (const [method, operation] of Object.entries(pathItem)) {
        if (!validMethods.includes(String(method).toLowerCase())) continue;
        if (!operation || typeof operation !== "object") continue;

        if (Array.isArray(operation.parameters)) {
          for (const param of operation.parameters) {
            if (param && typeof param === "object" && !param.$ref) {
              parameters.push({ param, pathRoute, level: "operation", method });
            }
          }
        }
      }
    }

    return parameters;
  }

  /**
   * Crea referencias para parámetros en paths, usando logicalMap
   */
  createReferences(paths, logicalMap) {
    const validMethods = [
      "get",
      "post",
      "put",
      "delete",
      "patch",
      "options",
      "head",
      "trace",
    ];

    for (const [pathRoute, pathItem] of Object.entries(paths)) {
      if (!pathItem || typeof pathItem !== "object") continue;

      this.parameterReferences[pathRoute] = {
        path: [],
        operations: {},
      };

      // Parámetros a nivel de path
      if (Array.isArray(pathItem.parameters)) {
        for (const param of pathItem.parameters) {
          if (!param || typeof param !== "object" || param.$ref) continue;

          const paramType = this.normalizeParamType(param.in);
          if (!paramType) continue;

          // ✅ Path params: deben existir en el template del path
          if (paramType === "path") {
            const pname = String(param.name || "").trim();
            if (!pname) continue;
            if (!this.pathHasPlaceholder(pathRoute, pname)) continue;
          }

          const logicalKey = this.getLogicalKey(param, paramType);
          const paramInfo = logicalMap[logicalKey];
          if (paramInfo) {
            this.parameterReferences[pathRoute].path.push({
              name: paramInfo.name,
              paramType: paramInfo.paramType,
            });
          }
        }
      }

      // Parámetros a nivel de operación
      for (const [method, operation] of Object.entries(pathItem)) {
        if (!validMethods.includes(String(method).toLowerCase())) continue;
        if (!operation || typeof operation !== "object") continue;

        if (Array.isArray(operation.parameters)) {
          this.parameterReferences[pathRoute].operations[method] = [];

          for (const param of operation.parameters) {
            if (!param || typeof param !== "object" || param.$ref) continue;

            const paramType = this.normalizeParamType(param.in);
            if (!paramType) continue;

            // ✅ Path params: deben existir en el template del path
            if (paramType === "path") {
              const pname = String(param.name || "").trim();
              if (!pname) continue;
              if (!this.pathHasPlaceholder(pathRoute, pname)) continue;
            }

            const logicalKey = this.getLogicalKey(param, paramType);
            const paramInfo = logicalMap[logicalKey];
            if (paramInfo) {
              this.parameterReferences[pathRoute].operations[method].push({
                name: paramInfo.name,
                paramType: paramInfo.paramType,
              });
            }
          }
        }
      }
    }
  }

  /**
   * Normaliza el "in" de OpenAPI a uno de: path|query|header|cookie
   */
  normalizeParamType(inValue) {
    const t = inValue == null ? "" : String(inValue).toLowerCase().trim();
    if (t === "path" || t === "query" || t === "header" || t === "cookie")
      return t;
    return null;
  }

  /**
   * Clave lógica de deduplicación:
   * in + name (case-insensitive)
   */
  getLogicalKey(param, paramType) {
    const name = String(param.name || "").trim().toLowerCase();
    return `${paramType}:${name}`;
  }

  /**
   * Merge defensivo de parámetros “equivalentes” (mismo in+name).
   * - required: si alguno es true => true
   * - schema: conservar el más “completo”
   * - description: preferir la más larga/no vacía
   * - deprecated/explode/style/allowEmptyValue: preferir valores explícitos
   * - example/examples: preferir el que exista
   * - content: preferir el que exista
   */
mergeParameter(baseParam, incomingParam, paramType) {
  let a = this.cloneDeep(baseParam || {}); // <- era const, debe ser let
  const b = incomingParam || {};

  // Nombre e in: mantener consistencia con el base
  a.name = a.name != null ? a.name : b.name;
  a.in = a.in != null ? a.in : (paramType || b.in);

  // required: si alguno true -> true
  a.required = Boolean(a.required) || Boolean(b.required);

  // description: preferir la más informativa
  a.description = this.preferLongerString(a.description, b.description);

  // deprecated
  if (a.deprecated === undefined && b.deprecated !== undefined) a.deprecated = b.deprecated;

  // style / explode / allowEmptyValue
  if (a.style === undefined && b.style !== undefined) a.style = b.style;
  if (a.explode === undefined && b.explode !== undefined) a.explode = b.explode;
  if (a.allowEmptyValue === undefined && b.allowEmptyValue !== undefined) a.allowEmptyValue = b.allowEmptyValue;

  // schema: tomar el más completo
  a.schema = this.pickMoreCompleteSchema(a.schema, b.schema);

  // example(s)
  if (a.example === undefined && b.example !== undefined) a.example = b.example;
  if (a.examples === undefined && b.examples !== undefined) a.examples = this.cloneDeep(b.examples);

  // content (OpenAPI permite parameter.content)
  if (a.content === undefined && b.content !== undefined) a.content = this.cloneDeep(b.content);

  // headers/extension fields: merge superficial conservador
  a = this.mergeExtensionsShallow(a, b);

  // path params en OAS deben ser required: true
  if (String(paramType).toLowerCase() === "path") {
    a.required = true;
  }

  return a;
}


  pickMoreCompleteSchema(schemaA, schemaB) {
    if (!schemaA && schemaB) return this.cloneDeep(schemaB);
    if (schemaA && !schemaB) return schemaA;
    if (!schemaA && !schemaB) return schemaA;

    const score = (s) => {
      if (!s || typeof s !== "object") return 0;
      let pts = 0;
      const keys = Object.keys(s);
      pts += keys.length;

      // Bonus por campos típicos de “completitud”
      if (s.format) pts += 2;
      if (s.enum) pts += 2;
      if (s.items) pts += 2;
      if (s.properties) pts += 3;
      if (s.allOf || s.oneOf || s.anyOf) pts += 3;
      if (s.$ref) pts += 3;
      return pts;
    };

    const aScore = score(schemaA);
    const bScore = score(schemaB);

    if (bScore > aScore) return this.cloneDeep(schemaB);

    // Si puntúan igual, merge superficial (sin “inventar”)
    const merged = this.cloneDeep(schemaA);
    for (const [k, v] of Object.entries(schemaB)) {
      if (merged[k] === undefined && v !== undefined) merged[k] = this.cloneDeep(v);
    }
    return merged;
  }

  preferLongerString(a, b) {
    const sa = (a == null) ? "" : String(a).trim();
    const sb = (b == null) ? "" : String(b).trim();
    if (!sa && sb) return sb;
    if (!sb && sa) return sa;
    return (sb.length > sa.length) ? sb : sa;
  }

  mergeExtensionsShallow(target, source) {
    // Mezcla x-... (extensions) de manera conservadora
    if (!source || typeof source !== "object") return target;
    for (const [k, v] of Object.entries(source)) {
      if (!k.startsWith("x-")) continue;
      if (target[k] === undefined && v !== undefined) {
        target[k] = this.cloneDeep(v);
      }
    }
    return target;
  }

  pathHasPlaceholder(pathRoute, paramName) {
    const route = String(pathRoute || "");
    const name = String(paramName || "").trim();
    if (!route || !name) return false;
    // match exact `{name}` en el template
    return route.includes(`{${name}}`);
  }

  /**
   * Genera nombre para parámetro (sin duplicarlo por contador salvo colisión real
   * por sanitización dentro del MISMO paramType).
   */
  generateParameterName(param, usedNames) {
    let baseName = String(param.name || "").trim();
    if (!baseName) baseName = "Param";

    baseName = baseName.charAt(0).toUpperCase() + baseName.slice(1);
    baseName = baseName.replace(/[^a-zA-Z0-9]/g, "");

    if (!baseName) baseName = "Param";

    let finalName = baseName;

    // Solo si hay colisión real (ej. X-Request-Id vs XRequestId)
    let counter = 1;
    while (usedNames.has(finalName)) {
      finalName = `${baseName}${counter}`;
      counter++;
    }

    usedNames.add(finalName);
    return finalName;
  }

  cloneDeep(value) {
    if (value == null) return value;
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return value;
    }
  }
}

module.exports = { ParameterExtractorService };
