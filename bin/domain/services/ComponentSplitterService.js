// bin/domain/services/ComponentSplitterService.js

const { Component } = require("../entities/Component");

/**
 * Domain Service: Divide components en archivos individuales
 */
class ComponentSplitterService {
  constructor(nameNormalizerService, referenceFixerService) {
    this.nameNormalizer = nameNormalizerService;
    this.referenceFixer = referenceFixerService;
  }

  /**
   * Divide components en archivos individuales
   */
  split(components, config) {
    if (!components || typeof components !== "object") {
      return { components: [], references: {} };
    }

    const result = [];
    const references = {};

    const componentTypes = [
      "schemas",
      "responses",
      "requestBodies",
      "parameters",
      "examples",
      "headers",
      "securitySchemes",
    ];

    for (const category of componentTypes) {
      if (
        !components[category] ||
        Object.keys(components[category]).length === 0
      ) {
        continue;
      }

      references[category] = {};

      for (const [key, content] of Object.entries(components[category])) {
        let name = key;
        let subCategory = null;

        // -----------------------------
        // PARAMETERS: resolver subCategory (header/query/path/cookie)
        // -----------------------------
        if (category === "parameters") {
          let actualContent = content;

          // Wrapper del extractor: { paramType, content }
          if (content && typeof content === "object" && content.paramType) {
            subCategory = this.normalizeParamType(content.paramType);
            actualContent = content.content;
          }

          // ✅ SIEMPRE intentar limpiar el nombre desde key "query_Status" => "Status"
          // incluso si subCategory ya fue resuelto por wrapper
          if (typeof key === "string" && key.includes("_")) {
            const parts = key.split("_");
            const possibleType = this.normalizeParamType(parts[0]);
            if (possibleType) {
              // si no teníamos subCategory aún, la seteamos; si ya estaba, la mantenemos
              if (!subCategory) subCategory = possibleType;

              // name lógico sin prefijo (ejemplo: query_UsernameQuery => UsernameQuery)
              name = parts.slice(1).join("_") || key;
            }
          }

          // Inferir desde "in" (si aún no se pudo)
          if (
            !subCategory &&
            actualContent &&
            typeof actualContent === "object"
          ) {
            subCategory = this.normalizeParamType(actualContent.in);
          }

          // Validación conservadora
          if (!subCategory) subCategory = null;

          // fixRefs
          let finalContent = actualContent;
          if (config.behavior?.fixRefs) {
            finalContent = this.referenceFixer.fixReferences(
              actualContent,
              category,
              config.paths?.mainFileName || "openapi",
              config.naming || {},
              config.affixes || {}
            );
          }

          const component = new Component(name, category, finalContent);
          const fileName = this.generateFileName(
            name,
            category,
            actualContent,
            config
          );

          result.push({ component, fileName, category, subCategory });

          const ext = config.advanced?.fileExtension || ".yaml";

          if (subCategory) {
            const refObj = {
              $ref: `./components/${category}/${subCategory}/${fileName}${ext}`,
            };

            // 1) key exacta (ej: "query_Status")
            references[category][key] = refObj;

            // 2) compat: si key era prefijada, también registrar sin prefijo
            if (typeof key === "string" && key.includes("_")) {
              const maybeName = key.split("_").slice(1).join("_");
              if (maybeName && !references[category][maybeName]) {
                references[category][maybeName] = refObj;
              }
            }

            // 3) name limpio
            if (name && !references[category][name]) {
              references[category][name] = refObj;
            }
          } else {
            const refObj = {
              $ref: `./components/${category}/${fileName}${ext}`,
            };
            references[category][key] = refObj;
            if (name && !references[category][name])
              references[category][name] = refObj;
          }

          continue; // listo parameters
        }

        // -----------------------------
        // SCHEMAS: submodularización (value/enum/model/error)
        // -----------------------------
        if (category === "schemas") {
          subCategory = this.classifySchemaSubcategory(name, content, config);
        }

        // -----------------------------
        // fixRefs para no-parameters
        // -----------------------------
        let finalContent = content;
        if (config.behavior?.fixRefs) {
          finalContent = this.referenceFixer.fixReferences(
            content,
            category,
            config.paths?.mainFileName || "openapi",
            config.naming || {},
            config.affixes || {}
          );
        }

        const component = new Component(name, category, finalContent);
        const fileName = this.generateFileName(name, category, content, config);

        result.push({ component, fileName, category, subCategory });

        // -----------------------------
        // references
        // -----------------------------
        const ext = config.advanced?.fileExtension || ".yaml";

        if (category === "schemas" && subCategory) {
          references[category][name] = {
            $ref: `./components/${category}/${subCategory}/${fileName}${ext}`,
          };
        } else {
          references[category][name] = {
            $ref: `./components/${category}/${fileName}${ext}`,
          };
        }
      }
    }

    return { components: result, references };
  }

  // -----------------------------
  // Clasificación de schemas
  // -----------------------------
  classifySchemaSubcategory(name, schema, config) {
    if (config?.modularizeSchemas?.enabled === false) return null;

    const buckets = config?.modularizeSchemas?.buckets || {
      enum: "enum",
      model: "model",
      value: "value",
      error: "error",
    };

    if (this.isErrorSchema(name, schema, config)) return buckets.error;
    if (this.isEnum(schema)) return buckets.enum;
    if (this.isObjectLikeSchema(schema)) return buckets.model;
    return buckets.value;
  }

  isErrorSchema(name, schema, config) {
    if (schema && typeof schema === "object" && schema["x-error"] === true)
      return true;

    const patterns = config?.modularizeSchemas?.errorNamePatterns || [
      "error",
      "exception",
      "fault",
      "problem",
      "apierror",
      "apiexception",
    ];

    const n = String(name || "").toLowerCase();
    return patterns.some((p) => n.includes(String(p).toLowerCase()));
  }

  isObjectLikeSchema(schema) {
    if (!schema || typeof schema !== "object") return false;

    const t = String(schema.type || "").toLowerCase();
    if (t === "object") return true;

    if (schema.properties && typeof schema.properties === "object") return true;
    if (
      Array.isArray(schema.allOf) ||
      Array.isArray(schema.oneOf) ||
      Array.isArray(schema.anyOf)
    )
      return true;

    return false;
  }

  normalizeParamType(value) {
    const t = value == null ? "" : String(value).toLowerCase().trim();
    if (t === "query" || t === "header" || t === "path" || t === "cookie")
      return t;
    return null;
  }

  /**
   * Genera nombre de archivo para componente
   */
  generateFileName(name, category, content, config) {
    console.log(`DEBUG generateFileName CALLED: name="${name}", category="${category}"`); // ← AGREGAR
    let cleanName = name;

    console.log(`DEBUG cleanName="${cleanName}"`); // ← AGREGAR
    // Para responses, eliminar sufijos numéricos
    if (category === "responses") {
      cleanName = cleanName.replace(/\d+$/, "");
      console.log("DEBUG returning early for responses"); // ← AGREGAR
      return cleanName;
    }

    // Detectar enums y usar sufijo especial
    if (
      category === "schemas" &&
      this.isEnum(content) &&
      config.affixes?.useEnumSuffix
    ) {
      cleanName = cleanName.replace(/Values?$/i, "");
      const convention = config.naming?.components || "PascalCase";
      let fileName = this.nameNormalizer.applyConvention(cleanName, convention);

      const enumSuffix = config.affixes?.enumSuffix || "Enum";

      // ✅ FIX: Verificar si ya tiene el sufijo de enum
      if (!fileName.endsWith(enumSuffix)) {
        fileName = fileName + enumSuffix;
      }

      return fileName;
    }

    // Detectar schemas genéricos y no aplicar sufijo
    if (category === "schemas" && this.isGenericSchema(cleanName, config)) {
      const convention = config.naming?.components || "PascalCase";
      return this.nameNormalizer.applyConvention(cleanName, convention);
    }

    // ✅ FIX CRÍTICO: Para parámetros, preservar sufijos de tipo (Query/Path/Header/Cookie)
    // que vienen del ParameterExtractorService para evitar colisiones en el bundle
    if (category === "parameters") {
      console.log("DEBUG generateFileName INPUT:", cleanName); // ← AGREGAR

      const typeSuffixMatch = cleanName.match(/(Query|Path|Header|Cookie)$/i);
      const typeSuffix = typeSuffixMatch ? typeSuffixMatch[1] : null;

      console.log("DEBUG typeSuffix:", typeSuffix); // ← AGREGAR

      let baseName = cleanName;
      if (typeSuffix) {
        baseName = cleanName.substring(0, cleanName.length - typeSuffix.length);
      }

      console.log("DEBUG baseName:", baseName); // ← AGREGAR

      baseName = baseName.replace(/Param$/i, "");

      const convention = config.naming?.components || "PascalCase";
      let fileName = this.nameNormalizer.applyConvention(baseName, convention);

      console.log("DEBUG fileName after convention:", fileName); // ← AGREGAR

      if (typeSuffix) {
        fileName = fileName + typeSuffix;
      }

      console.log("DEBUG FINAL fileName:", fileName); // ← AGREGAR

      return fileName;
    }

    const convention = config.naming?.components || "PascalCase";
    let fileName = this.nameNormalizer.applyConvention(cleanName, convention);

    // ✅ FIX: NO aplicar sufijo automático para parámetros
    // porque ya incluyen el tipo (Query, Path, Header, Cookie)
    if (
      category !== "parameters" &&
      config.affixes?.enabled &&
      config.affixes?.suffixes?.[category]
    ) {
      const suffix = config.affixes.suffixes[category];

      // Verificar si el nombre ya termina con el sufijo (case-insensitive)
      if (suffix && !fileName.endsWith(suffix)) {
        fileName = fileName + suffix;
      }
    }

    return fileName;
  }

  isEnum(content) {
    return (
      content &&
      typeof content === "object" &&
      Array.isArray(content.enum) &&
      content.type === "string"
    );
  }

  isGenericSchema(name, config) {
    const excludeList = config.affixes?.excludeFromSuffix || [];

    if (excludeList.length > 0) {
      return excludeList.some(
        (item) => item.toLowerCase() === name.toLowerCase()
      );
    }

    const defaultGenericNames = [
      "text",
      "name",
      "value",
      "datetime",
      "date",
      "time",
      "identifier",
      "code",
      "description",
      "amount",
      "quantity",
      "status",
      "type",
      "id",
      "reference",
    ];
    return defaultGenericNames.includes(String(name || "").toLowerCase());
  }
}

module.exports = { ComponentSplitterService };
