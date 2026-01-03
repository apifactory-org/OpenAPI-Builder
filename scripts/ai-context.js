#!/usr/bin/env node
/**
 * AI Context Generator
 * 
 * Genera documentación estructurada para que las IAs comprendan mejor el proyecto.
 * Crea dos archivos:
 *   - ai/context.json (formato canónico para consumo programático)
 *   - ai/context.md   (formato markdown para lectura humana)
 * 
 * El script analiza la estructura del proyecto, sus dependencias, arquitectura,
 * y calidad del código para generar un contexto completo y semánticamente rico.
 * 
 * @usage
 *   Básico:
 *     node scripts/ai-context.js
 * 
 *   Con perfil específico:
 *     node scripts/ai-context.js --profile=llm --maxLines=2500
 *     node scripts/ai-context.js --profile=debug --include-git --include-quality-details
 * 
 *   Retrocompatible (especificar solo maxLines):
 *     node scripts/ai-context.js 3000
 * 
 * @profiles
 *   - llm: Compacto, optimizado para contexto de LLMs (250 líneas de inventario)
 *   - default: Balanceado entre detalle y tamaño (500 líneas de inventario)
 *   - debug: Máximo detalle, incluye información de git y calidad (1200 líneas)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const repoRoot = process.cwd();

// ============================================================================
// UTILIDADES BÁSICAS
// ============================================================================

/**
 * Verifica si un archivo o directorio existe
 * @param {string} p - Ruta del archivo/directorio
 * @returns {boolean}
 */
function fileExists(p) {
  try { 
    fs.accessSync(p, fs.constants.F_OK); 
    return true; 
  } catch { 
    return false; 
  }
}

/**
 * Lee un archivo de texto
 * @param {string} filePath - Ruta del archivo
 * @returns {string} Contenido del archivo
 */
function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

/**
 * Parsea JSON de forma segura, retornando fallback en caso de error
 * @param {string} s - String JSON a parsear
 * @param {*} fallback - Valor por defecto si falla el parseo
 * @returns {*} Objeto parseado o fallback
 */
function safeJsonParse(s, fallback = null) {
  try { 
    return JSON.parse(s); 
  } catch { 
    return fallback; 
  }
}

/**
 * Elimina códigos ANSI de color y formato de un string
 * 
 * Los códigos ANSI son caracteres de control que los terminales usan para
 * colorear texto. Aparecen como secuencias tipo [90m, [97m, \x1B[0m, etc.
 * Esta función los elimina para obtener texto plano limpio.
 * 
 * @param {string} text - Texto que puede contener códigos ANSI
 * @returns {string} Texto sin códigos ANSI
 * 
 * @example
 *   stripAnsi('[90mGris[0m [97mBlanco[0m')
 *   // Returns: 'Gris Blanco'
 */
function stripAnsi(text) {
  if (!text) return text;
  return text
    // Secuencias ANSI completas: \x1B[...m o \u001b[...m
    .replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/\x1B\[[0-9;]*m/g, '')
    .replace(/\u001b\[[\d;]*m/g, '')
    .replace(/\u001B\[[\d;]*m/g, '')
    // Secuencias sin el escape visible: [90m, [97m, etc
    .replace(/\[[\d;]+m/g, '');
}

/**
 * Ejecuta un comando de shell de forma segura
 * 
 * Captura stdout y stderr, limpia códigos ANSI, y retorna un objeto
 * con información estructurada sobre el resultado de la ejecución.
 * 
 * @param {string} cmd - Comando a ejecutar
 * @param {object} opts - Opciones adicionales para execSync
 * @returns {object} Resultado estructurado { ok, out, err, cmd, code }
 * 
 * @example
 *   const result = tryExec('git status --porcelain');
 *   if (result.ok) {
 *     console.log('Output:', result.out);
 *   } else {
 *     console.error('Error:', result.err);
 *   }
 */
function tryExec(cmd, opts = {}) {
  try {
    const out = execSync(cmd, {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      ...opts,
    }).toString().trim();
    
    return { 
      ok: true, 
      out: stripAnsi(out), 
      cmd, 
      code: 0 
    };
  } catch (e) {
    const out = (e.stdout ? e.stdout.toString() : '').trim();
    const err = (e.stderr ? e.stderr.toString() : '').trim();
    
    return { 
      ok: false, 
      out: stripAnsi(out), 
      err: stripAnsi(err), 
      cmd, 
      code: e.status ?? 1 
    };
  }
}

// ============================================================================
// PARSEO DE ARGUMENTOS
// ============================================================================

/**
 * Parsea los argumentos de línea de comandos
 * 
 * Soporta dos formatos:
 *   1. Retrocompatible: node script.js 3000 (solo maxLines)
 *   2. Moderno: node script.js --profile=llm --maxLines=2500
 * 
 * @param {string[]} argv - Array de argumentos (process.argv)
 * @returns {object} Configuración parseada
 * 
 * @example
 *   parseArgs(['node', 'script.js', '--profile=debug', '--include-git'])
 *   // Returns: { profile: 'debug', includeGit: true, ... }
 */
function parseArgs(argv) {
  const args = {
    profile: 'default',        // llm | default | debug
    maxLines: 2000,            // Límite de líneas para context.md
    includeGit: false,         // Incluir info de git (branch, commits, etc)
    includeQualityDetails: false, // Incluir detalles completos de herramientas de calidad
    maxTreeLines: null,        // Límite de archivos en inventario (depende del profile)
  };

  const positional = [];
  
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];

    // Retrocompatibilidad: primer arg numérico = maxLines
    if (/^\d+$/.test(a) && positional.length === 0) {
      positional.push(a);
      continue;
    }

    // Parseo de flags modernos
    if (a.startsWith('--profile=')) {
      args.profile = a.split('=')[1] || args.profile;
    } else if (a === '--profile') { 
      args.profile = argv[i + 1] || args.profile; 
      i++; 
    } else if (a.startsWith('--maxLines=')) {
      args.maxLines = Number(a.split('=')[1] || args.maxLines);
    } else if (a === '--maxLines') { 
      args.maxLines = Number(argv[i + 1] || args.maxLines); 
      i++; 
    } else if (a === '--include-git') {
      args.includeGit = true;
    } else if (a === '--include-quality-details') {
      args.includeQualityDetails = true;
    } else if (a.startsWith('--maxTreeLines=')) {
      args.maxTreeLines = Number(a.split('=')[1]);
    } else if (a === '--maxTreeLines') { 
      args.maxTreeLines = Number(argv[i + 1]); 
      i++; 
    }
  }

  // Aplicar arg posicional retrocompatible
  if (positional.length === 1) {
    args.maxLines = Number(positional[0]);
  }

  // Configurar defaults según el profile
  if (args.profile === 'llm') {
    // Perfil compacto para LLMs: inventario reducido
    if (args.maxTreeLines == null) args.maxTreeLines = 250;
  } else if (args.profile === 'debug') {
    // Perfil debug: inventario extenso
    if (args.maxTreeLines == null) args.maxTreeLines = 1200;
  } else {
    // Perfil default: balanceado
    if (args.maxTreeLines == null) args.maxTreeLines = 500;
  }

  // Validación de límites razonables
  if (!Number.isFinite(args.maxLines) || args.maxLines <= 0) {
    args.maxLines = 2000;
  }
  if (!Number.isFinite(args.maxTreeLines) || args.maxTreeLines <= 0) {
    args.maxTreeLines = 500;
  }

  return args;
}

// ============================================================================
// LECTURA DE MANIFEST Y PACKAGE.JSON
// ============================================================================

/**
 * Carga y parsea archivo YAML
 * Requiere la dependencia 'yaml' instalada
 * 
 * @param {string} yamlText - Contenido YAML a parsear
 * @returns {object} Objeto parseado
 * @throws {Error} Si la dependencia 'yaml' no está instalada
 */
function loadYaml(yamlText) {
  try {
    const YAML = require('yaml');
    return YAML.parse(yamlText);
  } catch {
    throw new Error('Missing dependency "yaml". Install: npm i -D yaml');
  }
}

/**
 * Lee el manifest del proyecto (ai/manifest.yml)
 * 
 * El manifest contiene la metadata declarativa del proyecto:
 * intención autoritativa, modelo operacional, comandos, etc.
 * 
 * @returns {object|null} { path, raw, data } o null si no existe
 */
function readManifest() {
  const manifestPath = path.join(repoRoot, 'ai', 'manifest.yml');
  if (!fileExists(manifestPath)) return null;
  
  const raw = readText(manifestPath);
  const data = loadYaml(raw);
  
  return { 
    path: 'ai/manifest.yml', 
    raw, 
    data 
  };
}

/**
 * Extrae y resume información relevante del package.json
 * 
 * @returns {object|null} Información resumida del package o null si no existe
 * 
 * @example
 *   {
 *     name: 'my-project',
 *     version: '1.0.0',
 *     scripts: { test: 'jest', ... },
 *     dependencies: { express: '^4.18.0', ... },
 *     dependenciesTop: ['express', 'lodash', ...], // primeras 40
 *   }
 */
function summarizePackageJson() {
  const pkgPath = path.join(repoRoot, 'package.json');
  if (!fileExists(pkgPath)) return null;
  
  const pkg = safeJsonParse(readText(pkgPath), null);
  if (!pkg) return null;

  return {
    name: pkg.name,
    version: pkg.version,
    description: pkg.description,
    bin: pkg.bin || null,
    scripts: pkg.scripts || null,
    dependencies: pkg.dependencies || {},
    devDependencies: pkg.devDependencies || {},
    // Listas truncadas para inclusión en markdown
    dependenciesTop: Object.keys(pkg.dependencies || {}).slice(0, 40),
    devDependenciesTop: Object.keys(pkg.devDependencies || {}).slice(0, 40),
  };
}

// ============================================================================
// DETECCIÓN DE ARQUITECTURA HEXAGONAL
// ============================================================================

/**
 * Detecta capas de arquitectura hexagonal en el proyecto
 * 
 * Busca las carpetas convencionales de Clean Architecture:
 * - interface (UI, CLI, Controllers)
 * - application (Use Cases, Application Services)
 * - domain (Entidades, Servicios de Dominio, Value Objects)
 * - infrastructure (Adapters, Repositories, External Services)
 * 
 * También detecta puertos y adaptadores si existen.
 * 
 * @returns {object} { layers: [...], ports: string|null, adapters: string|null }
 */
function detectHexLayers() {
  const candidates = [
    { layer: 'interface', path: 'bin/interface' },
    { layer: 'application', path: 'bin/application' },
    { layer: 'domain', path: 'bin/domain' },
    { layer: 'infrastructure', path: 'bin/infrastructure' },
  ];

  const layers = candidates
    .filter(c => fileExists(path.join(repoRoot, c.path)))
    .map(c => ({ layer: c.layer, path: c.path }));

  const ports = fileExists(path.join(repoRoot, 'bin/application/ports')) 
    ? 'bin/application/ports' 
    : null;
    
  const adapters = fileExists(path.join(repoRoot, 'bin/infrastructure/adapters')) 
    ? 'bin/infrastructure/adapters' 
    : null;

  return { layers, ports, adapters };
}

// ============================================================================
// INVENTARIO DE ARCHIVOS (HIGH-SIGNAL)
// ============================================================================

/**
 * Genera un inventario curado de archivos con alto valor semántico
 * 
 * En lugar de listar todo el repositorio, esta función se enfoca en
 * archivos que tienen un rol arquitectónico claro:
 * - Puntos de entrada (main.js, CLI)
 * - Capas arquitectónicas (interface, application, domain, infrastructure)
 * - Configuración
 * - Documentación de AI
 * 
 * Ignora ruido como node_modules, dist, coverage, etc.
 * 
 * @returns {Array<object>} Lista de items { path, type, depth }
 * 
 * @example
 *   [
 *     { path: 'bin/main.js', type: 'file', depth: 0 },
 *     { path: 'bin/interface/', type: 'dir', depth: 0 },
 *     { path: 'bin/interface/cli/cli.js', type: 'file', depth: 2 },
 *     ...
 *   ]
 */
function listHighSignalInventory() {
  // Raíces a explorar
  const roots = [
    'bin/main.js',
    'bin/interface',
    'bin/application',
    'bin/domain',
    'bin/infrastructure',
    'config',
    'scripts/ai-context.js',
    'ai/manifest.yml',
    'package.json',
    '.dependency-cruiser.js',
  ];

  const items = [];
  
  for (const r of roots) {
    const abs = path.join(repoRoot, r);
    if (!fileExists(abs)) continue;

    const stat = fs.statSync(abs);
    
    // Archivo individual
    if (stat.isFile()) {
      items.push({ 
        path: r.replace(/\\/g, '/'), 
        type: 'file', 
        depth: 0 
      });
      continue;
    }

    // Directorio: explorar recursivamente con filtros
    const ignoreDirs = new Set(['.git', 'node_modules', 'dist', 'coverage', '.cache']);
    const includeExt = new Set(['.js', '.cjs', '.mjs', '.ts', '.yaml', '.yml', '.json', '.md']);

    /**
     * Recorre un directorio recursivamente buscando archivos con rol arquitectónico
     * @param {string} dir - Directorio a explorar
     * @param {number} depth - Profundidad actual
     */
    function walk(dir, depth) {
      if (depth > 6) return; // Límite de profundidad
      
      let dirents;
      try { 
        dirents = fs.readdirSync(dir, { withFileTypes: true }); 
      } catch { 
        return; 
      }
      
      dirents.sort((a, b) => a.name.localeCompare(b.name));

      for (const d of dirents) {
        if (d.isDirectory() && ignoreDirs.has(d.name)) continue;

        const full = path.join(dir, d.name);
        const rel = path.relative(repoRoot, full).replace(/\\/g, '/');

        if (d.isDirectory()) {
          // Incluir directorios de capas arquitectónicas
          if (depth <= 2) {
            items.push({ 
              path: `${rel}/`, 
              type: 'dir', 
              depth 
            });
          }
          walk(full, depth + 1);
        } else {
          const ext = path.extname(d.name);
          if (!includeExt.has(ext)) continue;
          
          // Filtro: solo archivos con rol arquitectónico claro
          const isRoleBearing =
            rel.includes('/use-cases/') ||
            rel.includes('/ports/') ||
            rel.includes('/adapters/') ||
            rel.includes('/services/') ||
            rel.includes('/entities/') ||
            rel.includes('/value-objects/') ||
            rel.includes('/cli/') ||
            rel.endsWith('DependencyContainer.js') ||
            rel.endsWith('main.js') ||
            rel.startsWith('config/') ||
            rel.startsWith('ai/') ||
            rel.startsWith('scripts/');

          if (isRoleBearing) {
            items.push({ 
              path: rel, 
              type: 'file', 
              depth 
            });
          }
        }
      }
    }

    walk(abs, 0);
  }

  // Eliminar duplicados preservando orden
  const seen = new Set();
  return items.filter(x => {
    if (seen.has(x.path)) return false;
    seen.add(x.path);
    return true;
  });
}

/**
 * Formatea el inventario de archivos como árbol visual
 * 
 * @param {Array<object>} items - Lista de items del inventario
 * @param {object} options - Opciones de formato
 * @param {boolean} options.useIcons - Usar emojis (📁📄) vs texto ([D][F])
 * @returns {Array<string>} Líneas formateadas del árbol
 * 
 * @example
 *   formatInventoryTree([
 *     { path: 'bin/', type: 'dir', depth: 0 },
 *     { path: 'bin/main.js', type: 'file', depth: 1 }
 *   ])
 *   // Returns: ['📁 bin/', '  📄 bin/main.js']
 */
function formatInventoryTree(items, { useIcons = true } = {}) {
  return items.map(item => {
    const isDir = item.type === 'dir' || item.path.endsWith('/');
    const icon = useIcons ? (isDir ? '📁' : '📄') : (isDir ? '[D]' : '[F]');
    const indent = '  '.repeat(Math.max(0, item.depth || 0));
    return `${indent}${icon} ${item.path}`;
  });
}

// ============================================================================
// DETECCIÓN DE COMANDOS CLI
// ============================================================================

/**
 * Extrae comandos del manifest si están declarados
 * @param {object} manifest - Objeto manifest parseado
 * @returns {Array<string>|null} Lista de comandos o null
 */
function extractCommandsFromManifest(manifest) {
  const cmds = manifest?.data?.operations?.commands;
  if (!Array.isArray(cmds)) return null;
  return cmds.map(c => c?.name).filter(Boolean);
}

/**
 * Detecta comandos CLI parseando archivos fuente (best effort)
 * 
 * Busca patrones como .command('nombre') en archivos CLI.
 * Es un enfoque heurístico para cuando no hay manifest.
 * 
 * @returns {Array<string>} Lista de comandos detectados
 */
function extractCommandsBestEffort() {
  const candidates = [
    'bin/interface/cli',
    'bin/interface',
    'bin',
  ].map(p => path.join(repoRoot, p)).filter(fileExists);

  const commands = new Set();

  /**
   * Escanea un archivo buscando .command('...')
   * @param {string} abs - Ruta absoluta del archivo
   */
  function scanFile(abs) {
    let txt;
    try { 
      txt = readText(abs); 
    } catch { 
      return; 
    }
    
    const re = /\.command\(\s*['"]([^'"]+)['"]/g;
    let m;
    while ((m = re.exec(txt)) !== null) {
      const cmd = (m[1] || '').trim();
      if (cmd && !cmd.includes(' ')) {
        commands.add(cmd);
      }
    }
  }

  /**
   * Recorre directorio buscando archivos .js
   * @param {string} dir - Directorio a explorar
   * @param {number} depth - Profundidad actual
   */
  function walk(dir, depth) {
    if (depth > 5) return;
    
    let dirents;
    try { 
      dirents = fs.readdirSync(dir, { withFileTypes: true }); 
    } catch { 
      return; 
    }
    
    for (const d of dirents) {
      const full = path.join(dir, d.name);
      if (d.isDirectory()) {
        walk(full, depth + 1);
      } else if (d.isFile() && d.name.endsWith('.js')) {
        scanFile(full);
      }
    }
  }

  for (const c of candidates) {
    const st = fs.statSync(c);
    if (st.isFile()) {
      scanFile(c);
    } else {
      walk(c, 0);
    }
  }

  // Filtrar solo comandos conocidos (evitar false positives)
  const allow = new Set(['modularize', 'bundle', 'docs', 'swagger2']);
  const filtered = Array.from(commands).filter(c => allow.has(c));
  return filtered.sort();
}

// ============================================================================
// NARRATIVA DE EJECUCIÓN
// ============================================================================

/**
 * Construye la narrativa de ejecución del proyecto
 * 
 * Explica cómo funciona el proyecto cuando se ejecutan sus comandos.
 * Prefiere la narrativa declarada en el manifest; si no existe, infiere una.
 * 
 * @param {object} manifest - Objeto manifest parseado
 * @returns {object} { source, confidence, value }
 */
function buildExecutionNarrative(manifest) {
  const declared = manifest?.data?.execution_narrative;
  
  if (declared && typeof declared === 'string') {
    return { 
      source: 'declared', 
      confidence: 'high', 
      value: declared 
    };
  }

  // Narrativa inferida (específica para openapi-builder)
  const inferred = [
    'When running openapi-builder modularize:',
    '- CLI parses flags and resolves cwd-relative paths.',
    '- Modularize use-case validates the input OpenAPI 3.x.',
    '- Domain services normalize response names, extract inline responses, deduplicate, split components and paths.',
    '- Writes a modular structure under ./src (main.yaml + components/ + paths/), fixing $ref as needed.',
    '',
    'When running openapi-builder bundle:',
    '- Takes modular entrypoint (default ./src/main.yaml).',
    '- Bundles into a single OpenAPI file (default ./dist/bundle.yaml), optionally removing unused components and validating.',
    '',
    'When running openapi-builder docs:',
    '- Uses the bundle as input (default ./dist/bundle.yaml) and generates Markdown docs (default ./docs/api.md).',
    '',
    'When running openapi-builder swagger2:',
    '- Converts bundle OpenAPI 3.x to Swagger 2.0 output (default ./dist/swagger2.yaml).',
  ].join('\n');

  return { 
    source: 'inferred', 
    confidence: 'medium', 
    value: inferred 
  };
}

// ============================================================================
// INPUTS Y OUTPUTS
// ============================================================================

/**
 * Construye la lista de inputs y outputs del proyecto
 * 
 * @param {object} manifest - Objeto manifest parseado
 * @returns {object} { inputs: [...], outputs: [...] }
 */
function buildInputsOutputs(manifest) {
  const outputs = [];
  const expected = manifest?.data?.product?.expected_outputs || [];
  
  for (const item of expected) {
    if (typeof item === 'string') {
      outputs.push({ 
        path: item, 
        description: null, 
        source: 'declared' 
      });
    } else if (item && typeof item === 'object') {
      outputs.push({
        path: item.path,
        description: item.description || null,
        guaranteed_after_success: item.guaranteed_after_success ?? null,
        must_exist_before: item.must_exist_before ?? null,
        idempotent: item.idempotent ?? null,
        source: 'declared',
      });
    }
  }

  const inputs = [];
  const configFiles = [
    './config/modularize.yaml',
    './config/bundle.yaml',
    './config/swagger2.yaml',
    './config/logging.yaml',
  ];
  
  for (const cf of configFiles) {
    inputs.push({ 
      kind: 'config', 
      path: cf, 
      required: false, 
      source: 'declared' 
    });
  }
  
  inputs.push({ 
    kind: 'manifest', 
    path: './ai/manifest.yml', 
    required: false, 
    source: 'declared' 
  });
  
  inputs.push({ 
    kind: 'openapi_spec', 
    path: '(varies: --build)', 
    required: true, 
    source: 'declared' 
  });

  return { inputs, outputs };
}

// ============================================================================
// ANÁLISIS DE CALIDAD
// ============================================================================

/**
 * Parsea el output de knip para extraer información estructurada
 * 
 * Knip puede reportar múltiples archivos en la misma línea o líneas separadas.
 * Ejemplos:
 *   "bin/main.js    knip.json  Remove redundant entry pattern"
 *   "bin/main.js  Remove redundant entry"
 * 
 * @param {string} output - Output completo de knip
 * @returns {object} { summary, issues, issueCount, hasMore }
 */
function parseKnipOutput(output) {
  if (!output) {
    return { 
      summary: 'no output', 
      issues: [], 
      issueCount: 0,
      hasMore: false
    };
  }
  
  const lines = output.split('\n').filter(Boolean);
  const issues = [];
  
  // Buscar el contador total de issues
  const issueMatch = output.match(/(\d+)\s+issue[s]?\s+found/i);
  const issueCount = issueMatch ? parseInt(issueMatch[1], 10) : null;
  
  // Parsear cada línea para extraer información estructurada
  for (const line of lines) {
    const cleanLine = line.trim();
    if (!cleanLine) continue;
    
    // Ignorar líneas de resumen
    if (cleanLine.match(/issue[s]?\s+found/i)) continue;
    if (cleanLine.match(/^✖/)) continue;
    if (cleanLine.match(/^$/)) continue;
    
    // Detectar si la línea tiene el patrón de knip
    // Formato: "archivo1    archivo2  mensaje" o "archivo  mensaje"
    const parts = cleanLine.split(/\s{2,}/); // Split por 2+ espacios
    
    if (parts.length >= 2) {
      const lastPart = parts[parts.length - 1];
      
      // El último elemento es el mensaje
      // Los anteriores son archivos afectados
      const files = parts.slice(0, -1);
      const message = lastPart.trim();
      
      // Crear un issue por cada archivo
      files.forEach(file => {
        const cleanFile = file.trim();
        if (cleanFile && !cleanFile.match(/^issue/i)) {
          issues.push({
            file: cleanFile,
            message: message
          });
        }
      });
    }
  }
  
  return {
    summary: issueCount 
      ? `${issueCount} issue(s) found` 
      : issues.length > 0 
        ? `${issues.length} issue(s) detected` 
        : 'no issues',
    issues: issues.slice(0, 5), // Primeros 5 issues
    issueCount: issueCount || issues.length,
    hasMore: issues.length > 5
  };
}

/**
 * Ejecuta herramientas de análisis de calidad del código
 * 
 * Ejecuta:
 * - knip: Detecta exports no usados, dependencias no usadas, etc.
 * - dependency-cruiser: Valida reglas de arquitectura (boundaries)
 * 
 * @param {object} options - Opciones de ejecución
 * @param {boolean} options.includeDetails - Incluir output completo
 * @param {string} options.profile - Perfil de ejecución (llm|default|debug)
 * @returns {object} Resultados estructurados de calidad
 */
function summarizeQuality({ includeDetails, profile }) {
  const result = {
    knip: { 
      status: 'unknown', 
      reason: null, 
      summary: null,
      issueCount: null,
      issues: [],
      details_truncated: true, 
      details: null, 
      source: 'measured' 
    },
    dependencyCruiser: { 
      status: 'unknown', 
      reason: null, 
      summary: null,
      details_truncated: true, 
      details: null, 
      source: 'measured' 
    },
  };

  // ========================================
  // KNIP: Detección de código no usado
  // ========================================
  const knipOut = tryExec('npx knip --no-progress');
  
  if (knipOut.ok) {
    // Exit 0 = sin issues
    result.knip.status = 'pass';
    result.knip.reason = 'no issues reported';
    result.knip.summary = 'clean';
    result.knip.issueCount = 0;
    
    if (includeDetails && profile !== 'llm') {
      result.knip.details_truncated = false;
      result.knip.details = knipOut.out || '(no output)';
    }
  } else {
    // Exit != 0 = hay issues
    result.knip.status = 'fail';
    
    const parsed = parseKnipOutput(knipOut.err || knipOut.out);
    result.knip.summary = parsed.summary;
    result.knip.issueCount = parsed.issueCount;
    result.knip.issues = parsed.issues;
    result.knip.reason = parsed.summary;
    
    if (includeDetails && profile !== 'llm') {
      result.knip.details_truncated = false;
      result.knip.details = {
        code: knipOut.code,
        parsedIssues: parsed.issues,
        err: (knipOut.err || '').split('\n').slice(0, 80).join('\n'),
        out: (knipOut.out || '').split('\n').slice(0, 80).join('\n'),
      };
    }
  }

  // ========================================
  // DEPENDENCY-CRUISER: Validación de arquitectura
  // ========================================
  if (fileExists(path.join(repoRoot, '.dependency-cruiser.js'))) {
    const depOut = tryExec('npx dependency-cruiser --validate .dependency-cruiser.js bin');
    
    if (depOut.ok) {
      result.dependencyCruiser.status = 'pass';
      result.dependencyCruiser.reason = 'no violations';
      result.dependencyCruiser.summary = 'clean';
      
      if (includeDetails && profile !== 'llm') {
        result.dependencyCruiser.details_truncated = false;
        result.dependencyCruiser.details = depOut.out || '(no output)';
      }
    } else {
      result.dependencyCruiser.status = 'fail';
      
      const cleanedOut = stripAnsi(depOut.err || depOut.out || '');
      const msg = cleanedOut.split('\n').find(Boolean) || `exit ${depOut.code}`;
      
      result.dependencyCruiser.reason = msg.slice(0, 200);
      result.dependencyCruiser.summary = 'violations found';
      
      if (includeDetails && profile !== 'llm') {
        result.dependencyCruiser.details_truncated = false;
        result.dependencyCruiser.details = {
          code: depOut.code,
          err: (depOut.err || '').split('\n').slice(0, 120).join('\n'),
          out: (depOut.out || '').split('\n').slice(0, 120).join('\n'),
        };
      }
    }
  } else {
    result.dependencyCruiser.status = 'skip';
    result.dependencyCruiser.reason = 'no config found';
    result.dependencyCruiser.summary = 'not configured';
  }

  return result;
}

// ============================================================================
// INFORMACIÓN DE GIT
// ============================================================================

/**
 * Recopila información del estado del repositorio git
 * 
 * @param {object} options - Opciones
 * @param {boolean} options.includeGit - Si incluir información de git
 * @param {string} options.profile - Perfil (para determinar nivel de detalle)
 * @returns {object} Estado de git { branch, lastCommit, dirty, statusSummary, ... }
 */
function summarizeGit({ includeGit, profile }) {
  if (!includeGit) {
    return { 
      source: 'measured', 
      included: false, 
      dirty: null, 
      branch: null, 
      lastCommit: null, 
      statusSummary: null, 
      details: null 
    };
  }

  const branch = tryExec('git rev-parse --abbrev-ref HEAD');
  const lastCommit = tryExec('git log -1 --oneline');
  const status = tryExec('git status --porcelain=v1');

  const statusText = status.ok ? status.out : '';
  const lines = statusText ? statusText.split('\n').filter(Boolean) : [];
  
  // Contar archivos modificados y no trackeados
  const modified = lines.filter(l => l.startsWith(' M') || l.startsWith('M ')).length;
  const untracked = lines.filter(l => l.startsWith('??')).length;
  const dirty = lines.length > 0;

  // En debug incluimos el status completo, en otros perfiles solo resumen
  const details = (profile === 'debug') ? statusText : null;

  return {
    source: 'measured',
    included: true,
    branch: branch.ok ? branch.out : null,
    lastCommit: lastCommit.ok ? lastCommit.out : null,
    dirty,
    modified_count: modified,
    untracked_count: untracked,
    statusSummary: dirty 
      ? `${modified} modified, ${untracked} untracked` 
      : 'clean',
    details,
  };
}

// ============================================================================
// FORMATEO DE DEPENDENCIAS
// ============================================================================

/**
 * Formatea una lista de dependencias para Markdown
 * 
 * @param {object} deps - Objeto { nombre: version, ... }
 * @param {number} limit - Máximo número de dependencias a mostrar
 * @returns {string} Texto formateado
 * 
 * @example
 *   formatDependenciesList({ express: '^4.18.0', lodash: '^4.17.21' }, 10)
 *   // Returns: '  - express@^4.18.0\n  - lodash@^4.17.21'
 */
function formatDependenciesList(deps, limit = 15) {
  if (!deps || Object.keys(deps).length === 0) {
    return '(none)';
  }
  
  const entries = Object.entries(deps).slice(0, limit);
  const formatted = entries
    .map(([name, version]) => `  - ${name}@${version}`)
    .join('\n');
  
  const remaining = Object.keys(deps).length - limit;
  
  if (remaining > 0) {
    return formatted + `\n  ... and ${remaining} more`;
  }
  
  return formatted;
}

// ============================================================================
// GENERACIÓN DE MARKDOWN
// ============================================================================

/**
 * Renderiza el documento canónico JSON como Markdown legible
 * 
 * Toma el objeto doc con toda la información estructurada y genera
 * un documento Markdown bien formateado para consumo humano.
 * 
 * @param {object} doc - Documento canónico JSON
 * @param {object} options - Opciones de renderizado
 * @param {number} options.maxLines - Límite de líneas
 * @returns {string} Documento Markdown completo
 */
function renderMarkdown(doc, { maxLines }) {
  // ========================================
  // EXTRACCIÓN DE DATOS
  // ========================================
  
  const p = doc.declared?.product?.value || {};
  const productName = p.name || doc.inferred?.product?.value?.name || 'Unknown';
  const productType = p.type || doc.inferred?.product?.value?.type || 'node-cli';
  const purpose = p.purpose || doc.inferred?.product?.value?.purpose || '(missing purpose)';

  const declaredIntent = doc.declared?.authoritative_intent?.value || '(missing)';
  const opModel = doc.declared?.operational_model?.value || {};
  const narrative = doc.execution_narrative?.value || '(missing)';

  const commandsDeclared = (doc.declared?.operations?.value?.commands || [])
    .map(c => c.name)
    .filter(Boolean);
  const commandsInferred = doc.inferred?.commands_detected?.value || [];
  const commands = commandsDeclared.length ? commandsDeclared : commandsInferred;

  // ========================================
  // ARQUITECTURA
  // ========================================
  
  const arch = doc.measured?.architecture?.value || {};
  const layers = (arch.layers || [])
    .map(l => `- ${l.layer}: \`${l.path}\``)
    .join('\n') || '- (not detected)';
  const ports = arch.ports ? `- ports: \`${arch.ports}\`` : '';
  const adapters = arch.adapters ? `- adapters: \`${arch.adapters}\`` : '';

  // ========================================
  // INPUTS/OUTPUTS
  // ========================================
  
  const io = doc.declared?.inputs_outputs?.value || { inputs: [], outputs: [] };
  
  const inputsRows = (io.inputs || []).map(i => {
    const exists = (i.path && i.path.startsWith('./')) 
      ? (fileExists(path.join(repoRoot, i.path.replace(/^\.\//, ''))) ? '✓' : '✗') 
      : '—';
    return `| ${i.kind || ''} | \`${i.path || ''}\` | ${i.required === true ? 'yes' : 'no'} | ${exists} |`;
  }).join('\n');

  const outputsRows = (io.outputs || []).map(o => {
    const exists = (o.path && o.path.startsWith('./')) 
      ? (fileExists(path.join(repoRoot, o.path.replace(/^\.\//, ''))) ? '✓' : '✗') 
      : '—';
    const ga = (o.guaranteed_after_success == null) ? '—' : String(o.guaranteed_after_success);
    const note = (!exists && o.guaranteed_after_success) 
      ? ' *(created on command success)*' 
      : '';
    return `| \`${o.path || ''}\` | ${o.description || ''}${note} | ${ga} | ${exists} |`;
  }).join('\n');

  // ========================================
  // INVENTARIO
  // ========================================
  
  const inv = doc.inventory?.value || [];
  const invFormatted = formatInventoryTree(inv);
  const invBlock = invFormatted.join('\n');

  // Estadísticas por capa
  const invStats = {
    interface: inv.filter(i => i.path.includes('bin/interface')).length,
    application: inv.filter(i => i.path.includes('bin/application')).length,
    domain: inv.filter(i => i.path.includes('bin/domain')).length,
    infrastructure: inv.filter(i => i.path.includes('bin/infrastructure')).length,
    config: inv.filter(i => i.path.startsWith('config/')).length,
  };

  // ========================================
  // CALIDAD
  // ========================================
  
  const quality = doc.measured?.quality?.value || {};
  
  // Formatear knip con lista de issues
  let qKnipText = '';
  if (quality.knip) {
    const status = quality.knip.status.toUpperCase();
    const summary = stripAnsi(quality.knip.summary || 'unknown');
    qKnipText = `${status}: ${summary}`;
    
    // Si hay issues, listarlos
    if (quality.knip.issues && quality.knip.issues.length > 0) {
      qKnipText += '\n  Issues found:';
      quality.knip.issues.forEach(issue => {
        const file = issue.file || 'unknown';
        const msg = issue.message || 'no description';
        qKnipText += `\n    - ${file}: ${msg}`;
      });
      
      if (quality.knip.hasMore) {
        const remaining = quality.knip.issueCount - quality.knip.issues.length;
        qKnipText += `\n    ... (${remaining} more)`;
      }
    }
  } else {
    qKnipText = 'UNKNOWN: not executed';
  }
  
  // Formatear dependency-cruiser
  const qDepStatus = quality.dependencyCruiser?.status?.toUpperCase() || 'UNKNOWN';
  const qDepMsg = stripAnsi(
    quality.dependencyCruiser?.summary || 
    quality.dependencyCruiser?.reason || 
    'unknown'
  );
  const qDep = `${qDepStatus}: ${qDepMsg}`;

  // ========================================
  // GIT
  // ========================================
  
  const git = doc.measured?.git?.value || {};
  const gitSummary = git.included
    ? `branch: ${git.branch || 'unknown'}\nlast commit: ${git.lastCommit || 'unknown'}\nstatus: ${git.statusSummary || 'unknown'}`
    : '(not included)';

  // ========================================
  // PACKAGE INFO
  // ========================================
  
  const pkg = doc.package?.value || {};
  const npmScripts = pkg.scripts 
    ? Object.keys(pkg.scripts).map(s => `- \`npm run ${s}\``).join('\n') 
    : '(none)';
  const mainDeps = formatDependenciesList(pkg.dependencies, 12);
  const devDeps = formatDependenciesList(pkg.devDependencies, 8);

  // ========================================
  // CONSTRUCCIÓN DEL MARKDOWN
  // ========================================
  
  const md = `# AI Context Pack — ${productName}

Generated: ${doc.meta.generated_at}
Repo root: ${doc.meta.repo_root}
Product type: ${productType}
Version: ${pkg.version || 'unknown'}

## 1) Authoritative Intent [DECLARED]
${declaredIntent}

## 2) Product summary [DECLARED]
**Name:** ${productName}
**Purpose:** ${purpose}
${pkg.bin ? `**Binary:** \`${Object.keys(pkg.bin)[0] || 'unknown'}\`` : ''}

## 3) Operational Model [DECLARED]
**Inputs (declared):**
${(opModel.declared_inputs || []).map(x => `- ${x.name} (${x.type})`).join('\n') || '- (missing)'}

**Invariants:**
${(opModel.invariants || []).map(inv => `- ${inv}`).join('\n') || '- (missing)'}

## 4) Execution Narrative [${doc.execution_narrative?.source?.toUpperCase?.() || 'INFERRED'}]
${narrative}

## 5) Operations / Commands
${(commands || []).map(c => `- \`${c}\``).join('\n') || '- (none detected)'}

## 6) Available npm scripts
${npmScripts}

## 7) Dependencies
### Runtime Dependencies
${mainDeps}

### Development Dependencies
${devDeps}

## 8) Inputs / Outputs
### Inputs
| kind | path | required | exists |
|---|---|---|---|
${inputsRows || '(none)'}

### Outputs
| path | description | guaranteed_after_success | exists |
|---|---|---|---|
${outputsRows || '(none)'}

*Note: Outputs marked with ✗ may not exist yet — they are created when running the respective commands.*

## 9) Architecture map (hexagonal) [MEASURED]
${layers}
${ports}
${adapters}

**File distribution:**
- Interface layer: ${invStats.interface} files
- Application layer: ${invStats.application} files
- Domain layer: ${invStats.domain} files
- Infrastructure layer: ${invStats.infrastructure} files
- Config files: ${invStats.config} files

## 10) Structural Inventory (high-signal)
\`\`\`text
${invBlock}
\`\`\`

## 11) Quality gates (summary)
\`\`\`text
Knip (unused exports/dependencies):
  ${qKnipText}

Dependency Cruiser (architecture boundaries):
  ${qDep}
\`\`\`

## 12) Ephemeral State (git)
\`\`\`text
${gitSummary}
\`\`\`

---
*Generated with profile: ${doc.meta.profile} | maxLines: ${doc.meta.flags.maxLines} | maxTreeLines: ${doc.meta.flags.maxTreeLines}*
`;

  // Truncar si excede maxLines
  const lines = md.split('\n');
  const truncated = lines.slice(0, maxLines).join('\n');
  const suffix = lines.length > maxLines 
    ? '\n… (truncated by maxLines)' 
    : '';
  
  return truncated + suffix;
}

// ============================================================================
// FUNCIÓN PRINCIPAL
// ============================================================================

/**
 * Punto de entrada principal del script
 * 
 * Orquesta todo el proceso:
 * 1. Parsear argumentos
 * 2. Leer manifest y package.json
 * 3. Analizar arquitectura, calidad, git
 * 4. Generar documento canónico JSON
 * 5. Renderizar vista Markdown
 * 6. Escribir ambos archivos
 */
function main() {
  const args = parseArgs(process.argv);

  // Asegurar que existe el directorio ai/
  const aiDir = path.join(repoRoot, 'ai');
  if (!fileExists(aiDir)) {
    fs.mkdirSync(aiDir, { recursive: true });
  }

  // Leer datos base
  const pkg = summarizePackageJson();
  const manifest = readManifest();
  
  if (!manifest) {
    console.error('✖ Missing ai/manifest.yml');
    console.error('  Create one with: echo "context_schema_version: 1.1" > ai/manifest.yml');
    process.exit(1);
  }

  // ========================================
  // CONSTRUCCIÓN DEL DOCUMENTO CANÓNICO
  // ========================================
  
  const doc = {
    // Metadata del contexto generado
    meta: {
      context_schema_version: manifest.data.context_schema_version || '1.1',
      generator: 'scripts/ai-context.js',
      generated_at: new Date().toISOString(),
      repo_root: repoRoot,
      profile: args.profile,
      flags: {
        include_git: args.includeGit,
        include_quality_details: args.includeQualityDetails,
        maxLines: args.maxLines,
        maxTreeLines: args.maxTreeLines,
      },
    },

    // Información DECLARADA (del manifest)
    declared: {
      product: { 
        source: 'declared', 
        confidence: 'high', 
        value: manifest.data.product || {} 
      },
      authoritative_intent: { 
        source: 'declared', 
        confidence: 'high', 
        value: manifest.data.authoritative_intent?.value || null 
      },
      operational_model: { 
        source: 'declared', 
        confidence: 'high', 
        value: manifest.data.operational_model || {} 
      },
      operations: { 
        source: 'declared', 
        confidence: 'high', 
        value: manifest.data.operations || {} 
      },
      ai_contract: { 
        source: 'declared', 
        confidence: 'high', 
        value: manifest.data.ai_contract || {} 
      },
      inputs_outputs: { 
        source: 'declared', 
        confidence: 'high', 
        value: buildInputsOutputs(manifest) 
      },
      known_ambiguities: { 
        source: 'declared', 
        confidence: 'high', 
        value: manifest.data.ai_contract?.known_ambiguities || 
               manifest.data.known_ambiguities || [] 
      },
    },

    // Información INFERIDA (heurísticas)
    inferred: {
      product: {
        source: 'inferred',
        confidence: 'medium',
        value: {
          name: manifest.data.product?.name || pkg?.name || null,
          type: manifest.data.product?.type || 'node-cli',
          purpose: manifest.data.product?.purpose || pkg?.description || null,
        },
      },
      commands_detected: {
        source: 'inferred',
        confidence: 'medium',
        value: extractCommandsFromManifest(manifest) || extractCommandsBestEffort(),
      },
    },

    // Información MEDIDA (análisis en tiempo real)
    measured: {
      architecture: { 
        source: 'measured', 
        confidence: 'high', 
        value: detectHexLayers() 
      },
      quality: { 
        source: 'measured', 
        confidence: 'high', 
        value: summarizeQuality({ 
          includeDetails: args.includeQualityDetails, 
          profile: args.profile 
        }) 
      },
      git: { 
        source: 'measured', 
        confidence: 'high', 
        value: summarizeGit({ 
          includeGit: args.includeGit, 
          profile: args.profile 
        }) 
      },
    },

    // Narrativa de ejecución
    execution_narrative: buildExecutionNarrative(manifest),

    // Inventario de archivos
    inventory: {
      source: 'measured',
      confidence: 'high',
      value: listHighSignalInventory().slice(0, args.maxTreeLines),
      truncated: true,
    },

    // Información del package.json
    package: {
      source: 'measured',
      confidence: 'high',
      value: pkg,
    },
  };

  // ========================================
  // ESCRIBIR ARCHIVOS DE SALIDA
  // ========================================
  
  // JSON canónico (para consumo programático)
  const jsonPath = path.join(aiDir, 'context.json');
  fs.writeFileSync(jsonPath, JSON.stringify(doc, null, 2), 'utf8');

  // Markdown (para lectura humana)
  const md = renderMarkdown(doc, { maxLines: args.maxLines });
  const mdPath = path.join(aiDir, 'context.md');
  fs.writeFileSync(mdPath, md, 'utf8');

  // ========================================
  // REPORTE FINAL
  // ========================================
  
  console.log('✔ Wrote ai/context.json (canonical)');
  console.log('✔ Wrote ai/context.md (view)');
  console.log(`ℹ profile=${args.profile} maxLines=${args.maxLines} maxTreeLines=${args.maxTreeLines}`);
  
  // Advertencias opcionales
  if (doc.measured.quality.value.knip.status === 'fail') {
    console.log(`⚠ Knip found ${doc.measured.quality.value.knip.issueCount} issue(s)`);
  }
  if (doc.measured.quality.value.dependencyCruiser.status === 'fail') {
    console.log('⚠ Dependency-cruiser found architecture violations');
  }
}

// ============================================================================
// EJECUCIÓN
// ============================================================================

main();