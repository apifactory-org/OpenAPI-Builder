// bin/infrastructure/adapters/RedoclyValidator.js

const {
  IValidator,
  ValidationResult,
} = require("../../application/ports/IValidator");

/**
 * Adapter: Validador usando Redocly CLI
 *
 * Objetivos:
 * 1) Parsear JSON de Redocly de forma robusta (format=json).
 * 2) Fallback a stylish con parseo estructurado.
 * 3) Lanzar error SOLO si hay errors[]; no depender de vr.success.
 */
class RedoclyValidator extends IValidator {
  constructor(executableResolver, commandRunner, logger) {
    super();
    this.executableResolver = executableResolver;
    this.commandRunner = commandRunner;
    this.logger = logger;
  }

  async validate(filePath) {
    const redoclyPath = this.executableResolver.resolve("redocly");

    if (!redoclyPath) {
      throw new Error(
        "No se encontró Redocly CLI en node_modules/.bin. " +
          "Instala @redocly/cli como dependencia."
      );
    }

    this.logger.info("Validando con Redocly...");

    // 1) Intento principal: JSON
    const commandJson = `"${redoclyPath}" lint "${filePath}" --format=json`;

    try {
      const { stdout = "", stderr = "" } = await this.commandRunner.run(
        commandJson
      );

      const result = this.tryParseJson(stdout) || this.tryParseJson(stderr);
      if (!result) {
        // Si no pudimos parsear JSON, fallback a stylish
        const vr = await this.validateWithStylish(redoclyPath, filePath);
        this.throwIfHasErrors(vr);
        return vr;
      }

      const vr = this.parseJsonResultToValidationResult(result);
      this.throwIfHasErrors(vr);
      return vr;
    } catch (error) {
      // En execPromise, si exitCode != 0, viene aquí con error.stdout/error.stderr
      const out = error?.stdout || "";
      const err = error?.stderr || "";

      const result = this.tryParseJson(out) || this.tryParseJson(err);
      if (result) {
        const vr = this.parseJsonResultToValidationResult(result);
        this.throwIfHasErrors(vr);
        return vr;
      }

      // Fallback final: stylish (también desde error stdout/stderr)
      const vr = this.parseStylishOutputToValidationResult(out, err);
      this.throwIfHasErrors(vr);
      return vr;
    }
  }

  throwIfHasErrors(validationResult) {
    const hasErrors =
      validationResult &&
      Array.isArray(validationResult.errors) &&
      validationResult.errors.length > 0;

    if (hasErrors) {
      throw new Error(this.formatValidationErrorMessage(validationResult));
    }
  }

  async validateWithStylish(redoclyPath, filePath) {
    const commandStylish = `"${redoclyPath}" lint "${filePath}" --format=stylish`;

    try {
      const { stdout = "", stderr = "" } = await this.commandRunner.run(
        commandStylish
      );
      return this.parseStylishOutputToValidationResult(stdout, stderr);
    } catch (error) {
      const stdout = error?.stdout || "";
      const stderr = error?.stderr || "";
      return this.parseStylishOutputToValidationResult(stdout, stderr);
    }
  }

  // -----------------------
  // JSON parsing (más robusto)
  // -----------------------
  tryParseJson(text) {
    if (!text || !String(text).trim()) return null;

    const s = String(text);

    // Redocly puede imprimir banners antes del JSON. Intentamos parsear desde
    // múltiples posiciones de "{" hasta que uno funcione (máximo 50 intentos).
    let idx = s.indexOf("{");
    let attempts = 0;

    while (idx !== -1 && attempts < 50) {
      const candidate = s.slice(idx).trim();
      try {
        return JSON.parse(candidate);
      } catch {
        // Buscar el siguiente "{"
        idx = s.indexOf("{", idx + 1);
        attempts++;
      }
    }

    return null;
  }

  parseJsonResultToValidationResult(result) {
    // Soporta:
    // - Formato moderno: { errors: [...], warnings: [...] }
    // - Formato legacy: { problems: [...], totals: { errors, warnings } }
    // - Algunas variantes donde severity puede ser 'warn'/'warning'
    let errorsRaw = [];
    let warningsRaw = [];

    if (Array.isArray(result?.errors) || Array.isArray(result?.warnings)) {
      errorsRaw = Array.isArray(result?.errors) ? result.errors : [];
      warningsRaw = Array.isArray(result?.warnings) ? result.warnings : [];
    } else if (Array.isArray(result?.problems)) {
      // legacy-ish
      for (const p of result.problems) {
        const sev = String(p?.severity || "").toLowerCase();
        if (sev === "error") errorsRaw.push(p);
        else if (sev === "warn" || sev === "warning") warningsRaw.push(p);
      }
    } else if (
      result?.totals &&
      (result.totals.errors || result.totals.warnings)
    ) {
      // Si llega totals sin problems, no hay detalle. Creamos placeholders.
      const eCount = Number(result.totals.errors || 0);
      const wCount = Number(result.totals.warnings || 0);
      errorsRaw = new Array(eCount).fill({
        message: "Error de validación (sin detalle JSON)",
      });
      warningsRaw = new Array(wCount).fill({
        message: "Warning de validación (sin detalle JSON)",
      });
    }

    const errors = errorsRaw.map((e) => this.formatJsonProblem(e));
    const warnings = warningsRaw.map((w) => this.formatJsonProblem(w));

    if (errors.length === 0) {
      this.logger.success("✔ Validación exitosa");
      if (warnings.length > 0) {
        this.logger.warn(`⚠ ${warnings.length} advertencia(s)`);
        warnings.slice(0, 10).forEach((w) => this.logger.warn(`  • ${w}`));
        if (warnings.length > 10)
          this.logger.warn(`  • ... (${warnings.length - 10} más)`);
      }
      return new ValidationResult(true, [], warnings);
    }

    this.logger.error(`✖ ${errors.length} error(es) de validación`);
    errors.slice(0, 20).forEach((e) => this.logger.error(`  • ${e}`));
    if (errors.length > 20)
      this.logger.error(`  • ... (${errors.length - 20} más)`);

    return new ValidationResult(false, errors, warnings);
  }

  formatJsonProblem(p) {
    const rule = p?.ruleId ? `[${p.ruleId}] ` : "";
    const message = p?.message ? String(p.message) : "Problema de validación";

    // location moderno: { source, line, col, pointer }
    // legacy en algunos casos: location: [{ pointer, ... }]
    let loc = "";
    const location = p?.location;

    if (Array.isArray(location) && location.length > 0) {
      loc = this.formatLocationObject(location[0]);
    } else if (location && typeof location === "object") {
      loc = this.formatLocationObject(location);
    } else if (p?.file) {
      loc = String(p.file);
    }

    return `${loc ? loc + " " : ""}${rule}${message}`.trim();
  }

  safeStringify(value) {
    try {
      const seen = new WeakSet();
      return JSON.stringify(value, (k, v) => {
        if (v && typeof v === "object") {
          if (seen.has(v)) return "[Circular]";
          seen.add(v);
        }
        return v;
      });
    } catch {
      try {
        return String(value);
      } catch {
        return "";
      }
    }
  }

  formatLocationObject(loc) {
    const source =
      loc?.source == null
        ? ""
        : typeof loc.source === "string"
        ? loc.source
        : loc.source.absoluteRef ||
          loc.source.ref ||
          this.safeStringify(loc.source);

    const line = typeof loc?.line === "number" ? `:${loc.line}` : "";
    const col = typeof loc?.col === "number" ? `:${loc.col}` : "";
    const pointer = loc?.pointer ? ` ${loc.pointer}` : "";
    return `${source}${line}${col}${pointer}`.trim();
  }

  // -----------------------
  // Stylish fallback parsing
  // -----------------------
  parseStylishOutputToValidationResult(stdout, stderr) {
    const output = [stdout, stderr].filter(Boolean).join("\n");
    const { errors, warnings } = this.parseStylishProblems(output);

    if (errors.length === 0) {
      this.logger.success("✔ Validación exitosa");
      if (warnings.length > 0) {
        this.logger.warn(`⚠ ${warnings.length} advertencia(s)`);
        warnings.slice(0, 10).forEach((w) => this.logger.warn(`  • ${w}`));
        if (warnings.length > 10)
          this.logger.warn(`  • ... (${warnings.length - 10} más)`);
      }
      return new ValidationResult(true, [], warnings);
    }

    this.logger.error(`✖ ${errors.length} error(es) de validación`);
    errors.slice(0, 20).forEach((e) => this.logger.error(`  • ${e}`));
    if (errors.length > 20)
      this.logger.error(`  • ... (${errors.length - 20} más)`);

    return new ValidationResult(false, errors, warnings);
  }

  parseStylishProblems(output) {
    const errors = [];
    const warnings = [];
    if (!output) return { errors, warnings };

    let currentFile = "";
    const lines = String(output).split(/\r?\n/);

    for (const raw of lines) {
      const line = raw.trimEnd();

      // Encabezado de archivo: "...yaml:" o "...yml:"
      // (más robusto que "no spaces", porque rutas pueden tener espacios)
      if (/\.(ya?ml):\s*$/i.test(line)) {
        currentFile = line.replace(/:\s*$/g, "");
        continue;
      }

      // "  12:7  error    rule-id  message"
      const m = line.match(
        /^\s*(\d+):(\d+)\s+(error|warning)\s+([a-z0-9-]+)\s+(.*)$/i
      );
      if (!m) continue;

      const [, ln, col, sev, ruleId, msg] = m;
      const formatted = `${currentFile}:${Number(ln)}:${Number(
        col
      )} [${ruleId}] ${msg}`.trim();

      if (sev.toLowerCase() === "error") errors.push(formatted);
      else warnings.push(formatted);
    }

    return { errors, warnings };
  }

  // -----------------------
  // Error message
  // -----------------------
  formatValidationErrorMessage(validationResult) {
    const lines = [];
    lines.push("Errores de validación:");
    for (const e of validationResult.errors || []) {
      lines.push(`- ${e}`);
    }

    if (validationResult.warnings && validationResult.warnings.length > 0) {
      lines.push("");
      lines.push(`Warnings: ${validationResult.warnings.length}`);
      validationResult.warnings
        .slice(0, 10)
        .forEach((w) => lines.push(`- ${w}`));
      if (validationResult.warnings.length > 10) {
        lines.push(`- ... (${validationResult.warnings.length - 10} más)`);
      }
    }

    return lines.join("\n");
  }
}

module.exports = { RedoclyValidator };
