// bin/domain/services/ResponseDeduplicatorService.js

const { StatusCode } = require("../value-objects/StatusCode");

/**
 * Domain Service: Deduplicación y normalización de respuestas existentes
 *
 * FIX:
 * - Deduplicación por grupos (2-pass) para poder elegir un "canonical name"
 *   con heurística estable (evita casos como 200 -> UnexpectedErrorResponse).
 * - Preferir nombres "no error-like" cuando haya colisión por misma firma.
 *
 * HOTFIX ADICIONAL (el importante para tu caso):
 * - Si statusCode es "default" (porque el nombre no trae 3 dígitos),
 *   NO mapear a statusNames.default (UnexpectedError), sino preservar el nombre original.
 */
class ResponseDeduplicatorService {
  constructor(nameNormalizerService, config = {}) {
    this.nameNormalizer = nameNormalizerService;
    this.config = config;
  }

  /**
   * Normaliza y deduplica respuestas existentes en components.responses
   */
  normalize(responses) {
    if (!this.config.enabled) {
      return { normalized: {}, nameMapping: {}, refMapping: {} };
    }

    if (!responses || Object.keys(responses).length === 0) {
      return { normalized: {}, nameMapping: {}, refMapping: {} };
    }

    const convention = this.config.namingConvention || "PascalCase";

    // 1) Materializar items con su dedupeKey + finalName + normalizedContent
    const items = [];
    for (const [originalName, content] of Object.entries(responses)) {
      const statusCode = this.extractStatusCode(originalName);
      const contentSignature = this.getContentSignature(content);
      const isSimple = this.isSimpleResponse(content);

      // Generar clave de deduplicación (igual a tu lógica previa)
      let dedupeKey;
      if (isSimple) {
        dedupeKey = "simple:" + statusCode.toString();
      } else if (contentSignature) {
        dedupeKey = statusCode.toString() + ":" + contentSignature;
      } else {
        dedupeKey = "unique:" + originalName;
      }

      // Normalizar nombre
      const newName = this.normalizeResponseName(
        originalName,
        statusCode,
        (content && content.description) || ""
      );
      const finalName = this.nameNormalizer.applyConvention(newName, convention);

      // Normalizar contenido
      const normalizedContent = this.normalizeContent(content, statusCode);

      items.push({
        originalName,
        statusCode,
        dedupeKey,
        finalName,
        normalizedContent,
      });
    }

    // 2) Agrupar por dedupeKey
    const groups = new Map(); // dedupeKey -> items[]
    for (const it of items) {
      if (!groups.has(it.dedupeKey)) groups.set(it.dedupeKey, []);
      groups.get(it.dedupeKey).push(it);
    }

    const normalized = {};
    const nameMapping = {};
    const refMapping = {};

    // 3) Elegir canónico por grupo, y mapear el resto
    for (const [dedupeKey, groupItems] of groups.entries()) {
      const canonical = this.chooseCanonical(groupItems);

      // Guardar canónico
      normalized[canonical.finalName] = canonical.normalizedContent;

      // Mapear cada original a su destino (canónico)
      for (const it of groupItems) {
        const oldRef = `#/components/responses/${it.originalName}`;
        const newRef = `#/components/responses/${canonical.finalName}`;

        const isDuplicate = it.originalName !== canonical.originalName;

        if (isDuplicate) {
          refMapping[oldRef] = newRef;
          nameMapping[it.originalName] = `${canonical.finalName} (deduplicado)`;
          continue;
        }

        // Canónico: si su finalName cambió vs originalName, registrar mapping
        if (canonical.finalName !== canonical.originalName) {
          nameMapping[canonical.originalName] = canonical.finalName;
          refMapping[oldRef] = newRef;
        }
      }
    }

    return { normalized, nameMapping, refMapping };
  }

  /**
   * Elige el nombre canónico dentro de un grupo de respuestas equivalentes.
   */
  chooseCanonical(groupItems) {
    let best = null;
    let bestScore = -Infinity;

    for (const it of groupItems) {
      const score = this.scoreResponseName(it);
      if (score > bestScore) {
        bestScore = score;
        best = it;
      } else if (score === bestScore && best) {
        const a = String(it.finalName || "").toLowerCase();
        const b = String(best.finalName || "").toLowerCase();
        if (a < b) best = it;
      }
    }

    return best || groupItems[0];
  }

  /**
   * Scoring heurístico para escoger canónico.
   */
  scoreResponseName(item) {
    let score = 0;

    const name = item.finalName || item.originalName || "";
    const originalName = item.originalName || "";
    const numericCode = item.statusCode ? item.statusCode.toNumber() : null;

    // 1) Preferir no error-like
    if (this.isErrorLikeName(name) || this.isErrorLikeName(originalName)) {
      score -= 50;
    } else {
      score += 20;
    }

    // 2) Preferir 2xx, penalizar 4xx/5xx si hay código
    if (typeof numericCode === "number" && !Number.isNaN(numericCode)) {
      if (numericCode >= 200 && numericCode < 300) score += 30;
      else if (numericCode >= 400 && numericCode < 600) score -= 10;
    }

    // 3) Preferir conservar el nombre si no requiere cambios
    if (item.finalName === item.originalName) score += 5;

    // 4) Preferir nombres con Response suffix
    if (/Response$/i.test(name)) score += 2;

    // 5) Preferir nombres más cortos levemente
    score -= Math.min(10, Math.floor(name.length / 20));

    return score;
  }

  /**
   * Heurística para detectar nombres "error-like".
   */
  isErrorLikeName(name) {
    const n = String(name || "").toLowerCase();

    const patterns = [
      "error",
      "exception",
      "fault",
      "problem",
      "unexpected",
      "badrequest",
      "unauthorized",
      "forbidden",
      "notfound",
      "toomany",
      "internalserver",
      "gateway",
      "serviceunavailable",
      "timeout",
      "unprocessable",
      "methodnotallowed",
      "invalid",
    ];

    return patterns.some((p) => n.includes(p));
  }

  /**
   * Extrae código de estado del nombre de respuesta
   */
  extractStatusCode(name) {
    const match = name.match(/(\d{3})/);
    if (match) {
      return new StatusCode(match[1]);
    }
    return new StatusCode("default");
  }

  /**
   * Normaliza nombre de respuesta
   *
   * FIX CLAVE:
   * - Si statusCode es default (no hay 3 dígitos en el nombre),
   *   preservamos el nombre original (NO usar statusNames.default).
   */
  normalizeResponseName(originalName, statusCode, description) {
    const numericCode = statusCode.toNumber();

    // ✅ HOTFIX: default => preservar nombre original
    if (statusCode.isDefault()) {
      let name = originalName;

      if (this.config.removeStatusCodeFromName) {
        name = name.replace(/\d{3}$/, "").replace(/\d{3}/, "");
      }

      // Limpiar sufijo Response existente antes de re-aplicar (comportamiento consistente)
      name = name.replace(/Response$/i, "");

      if (this.config.ensureResponseSuffix) {
        name = name + "Response";
      }

      return name;
    }

    // Verificar si debe preservarse el nombre custom
    if (numericCode && this.shouldPreserveCustomName(numericCode)) {
      let name = originalName;
      if (this.config.removeStatusCodeFromName) {
        name = name.replace(/\d{3}$/, "");
      }
      if (this.config.ensureResponseSuffix && !name.endsWith("Response")) {
        name = name + "Response";
      }
      return name;
    }

    // Generar nombre semántico
    let baseName = "";
    if (this.config.useSemanticNames) {
      const statusNames = this.config.statusNames || {};

      if (statusNames[statusCode.toString()]) {
        baseName = statusNames[statusCode.toString()];
      } else {
        baseName = this.nameNormalizer.sanitize(description) || originalName;
        if (this.config.removeStatusCodeFromName) {
          baseName = baseName.replace(/\d{3}$/, "").replace(/\d{3}/, "");
        }
      }
    } else {
      baseName = originalName;
      if (this.config.removeStatusCodeFromName) {
        baseName = baseName.replace(/\d{3}$/, "").replace(/\d{3}/, "");
      }
    }

    // Limpiar sufijo Response existente
    baseName = baseName.replace(/Response$/i, "");

    // Agregar sufijo Response si está configurado
    if (this.config.ensureResponseSuffix) {
      baseName = baseName + "Response";
    }

    // Agregar código si está configurado
    if (this.config.includeStatusCodeInName && !statusCode.isDefault()) {
      baseName = baseName + statusCode.toString();
    }

    return baseName;
  }

  /**
   * Normaliza el contenido de la respuesta
   */
  normalizeContent(content, statusCode) {
    const normalized = Object.assign({}, content);

    const genericDescriptions = this.getGenericDescriptions();
    const codeStr = statusCode.toString();

    if (genericDescriptions[codeStr]) {
      normalized.description = genericDescriptions[codeStr];
    }

    return normalized;
  }

  /**
   * Verifica si debe preservarse el nombre custom
   */
  shouldPreserveCustomName(statusCode) {
    const preserveList = this.config.preserveCustomNames || [];

    for (const pattern of preserveList) {
      if (pattern === String(statusCode)) return true;
      if (pattern === "2xx" && statusCode >= 200 && statusCode < 300) return true;
      if (pattern === "4xx" && statusCode >= 400 && statusCode < 500) return true;
      if (pattern === "5xx" && statusCode >= 500 && statusCode < 600) return true;
    }

    return false;
  }

  /**
   * Obtiene firma de contenido para deduplicación
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
   * Verifica si es respuesta simple
   */
  isSimpleResponse(response) {
    const keys = Object.keys(response || {});
    return keys.length === 0 || (keys.length === 1 && keys[0] === "description");
  }

  /**
   * Obtiene descripciones genéricas por código de estado
   */
  getGenericDescriptions() {
    return {
      "200": "Successful operation",
      "201": "Resource created successfully",
      "202": "Request accepted",
      "204": "No content",
      "400": "Bad request",
      "401": "Unauthorized",
      "403": "Forbidden",
      "404": "Resource not found",
      "405": "Method not allowed",
      "409": "Conflict",
      "422": "Unprocessable entity",
      "429": "Too many requests",
      "500": "Internal server error",
      "501": "Not implemented",
      "502": "Bad gateway",
      "503": "Service unavailable",
      "504": "Gateway timeout",
      default: "Unexpected error",
    };
  }
}

module.exports = { ResponseDeduplicatorService };
