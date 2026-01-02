#!/usr/bin/env node
/* scripts/ai-context.js
 * Generates AI-ingestable context artifacts:
 *  - ai/context.json (canonical)
 *  - ai/context.md   (human view)
 *
 * Backward compatible usage:
 *   node scripts/ai-context.js 3000
 *
 * Preferred usage:
 *   node scripts/ai-context.js --profile=llm --maxLines=2500
 *   node scripts/ai-context.js --profile=debug --include-git --include-quality-details
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const repoRoot = process.cwd();

function fileExists(p) {
  try { fs.accessSync(p, fs.constants.F_OK); return true; } catch { return false; }
}
function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}
function safeJsonParse(s, fallback = null) {
  try { return JSON.parse(s); } catch { return fallback; }
}
function tryExec(cmd, opts = {}) {
  try {
    const out = execSync(cmd, {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      ...opts,
    }).toString('utf8').trim();
    return { ok: true, out, cmd, code: 0 };
  } catch (e) {
    const out = (e.stdout ? e.stdout.toString('utf8') : '').trim();
    const err = (e.stderr ? e.stderr.toString('utf8') : '').trim();
    return { ok: false, out, err, cmd, code: e.status ?? 1 };
  }
}

function parseArgs(argv) {
  // Backward-compat: if first arg is number => maxLines
  const args = {
    profile: 'default', // llm | default | debug
    maxLines: 2000,
    includeGit: false,
    includeQualityDetails: false,
    maxTreeLines: null, // profile-dependent
  };

  const positional = [];
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];

    if (/^\d+$/.test(a) && positional.length === 0) {
      positional.push(a);
      continue;
    }

    if (a.startsWith('--profile=')) args.profile = a.split('=')[1] || args.profile;
    else if (a === '--profile') { args.profile = argv[i + 1] || args.profile; i++; }
    else if (a.startsWith('--maxLines=')) args.maxLines = Number(a.split('=')[1] || args.maxLines);
    else if (a === '--maxLines') { args.maxLines = Number(argv[i + 1] || args.maxLines); i++; }
    else if (a === '--include-git') args.includeGit = true;
    else if (a === '--include-quality-details') args.includeQualityDetails = true;
    else if (a.startsWith('--maxTreeLines=')) args.maxTreeLines = Number(a.split('=')[1]);
    else if (a === '--maxTreeLines') { args.maxTreeLines = Number(argv[i + 1]); i++; }
  }

  if (positional.length === 1) {
    args.maxLines = Number(positional[0]);
  }

  // Profile defaults
  if (args.profile === 'llm') {
    if (args.maxTreeLines == null) args.maxTreeLines = 250;
    // keep git/quality details off by default
  } else if (args.profile === 'debug') {
    if (args.maxTreeLines == null) args.maxTreeLines = 1200;
  } else {
    if (args.maxTreeLines == null) args.maxTreeLines = 500;
  }

  // Safety: sane bounds
  if (!Number.isFinite(args.maxLines) || args.maxLines <= 0) args.maxLines = 2000;
  if (!Number.isFinite(args.maxTreeLines) || args.maxTreeLines <= 0) args.maxTreeLines = 500;

  return args;
}

function loadYaml(yamlText) {
  try {
    const YAML = require('yaml');
    return YAML.parse(yamlText);
  } catch {
    throw new Error('Missing dependency "yaml". Install: npm i -D yaml');
  }
}

function readManifest() {
  const manifestPath = path.join(repoRoot, 'ai', 'manifest.yml');
  if (!fileExists(manifestPath)) return null;
  const raw = readText(manifestPath);
  const data = loadYaml(raw);
  return { path: 'ai/manifest.yml', raw, data };
}

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
    dependenciesTop: Object.keys(pkg.dependencies || {}).slice(0, 40),
    devDependenciesTop: Object.keys(pkg.devDependencies || {}).slice(0, 40),
  };
}

function detectHexLayers() {
  // Declarative detection by folder convention
  const candidates = [
    { layer: 'interface', path: 'bin/interface' },
    { layer: 'application', path: 'bin/application' },
    { layer: 'domain', path: 'bin/domain' },
    { layer: 'infrastructure', path: 'bin/infrastructure' },
  ];

  const layers = candidates
    .filter(c => fileExists(path.join(repoRoot, c.path)))
    .map(c => ({ layer: c.layer, path: c.path }));

  const ports = fileExists(path.join(repoRoot, 'bin/application/ports')) ? 'bin/application/ports' : null;
  const adapters = fileExists(path.join(repoRoot, 'bin/infrastructure/adapters')) ? 'bin/infrastructure/adapters' : null;

  return { layers, ports, adapters };
}

function listHighSignalInventory() {
  // Instead of a full repo tree, emit a curated inventory focused on architecture roles.
  // This is intentionally opinionated to increase semantic signal.
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

    // If it's a directory, list shallowly up to some depth but only for signal-bearing files
    const stat = fs.statSync(abs);
    if (stat.isFile()) {
      items.push(r.replace(/\\/g, '/'));
      continue;
    }

    // directory walk limited, skipping noise
    const ignoreDirs = new Set(['.git', 'node_modules', 'dist', 'coverage', '.cache']);
    const includeExt = new Set(['.js', '.cjs', '.mjs', '.ts', '.yaml', '.yml', '.json', '.md']);

    function walk(dir, depth) {
      if (depth > 6) return;
      let dirents;
      try { dirents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      dirents.sort((a, b) => a.name.localeCompare(b.name));

      for (const d of dirents) {
        if (d.isDirectory() && ignoreDirs.has(d.name)) continue;

        const full = path.join(dir, d.name);
        const rel = path.relative(repoRoot, full).replace(/\\/g, '/');

        if (d.isDirectory()) {
          // Always include layer directories, but not everything else
          if (depth <= 2) items.push(`${rel}/`);
          walk(full, depth + 1);
        } else {
          const ext = path.extname(d.name);
          if (!includeExt.has(ext)) continue;
          // prioritize role-bearing filenames
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

          if (isRoleBearing) items.push(rel);
        }
      }
    }

    walk(abs, 0);
  }

  // de-dup while preserving order
  const seen = new Set();
  return items.filter(x => (seen.has(x) ? false : (seen.add(x), true)));
}

function extractCommandsFromManifest(manifest) {
  const cmds = manifest?.data?.operations?.commands;
  if (!Array.isArray(cmds)) return null;
  return cmds.map(c => c?.name).filter(Boolean);
}

function extractCommandsBestEffort() {
  // Heuristic: parse .command('x') in likely CLI files
  const candidates = [
    'bin/interface/cli',
    'bin/interface',
    'bin',
  ].map(p => path.join(repoRoot, p)).filter(fileExists);

  const commands = new Set();

  function scanFile(abs) {
    let txt;
    try { txt = readText(abs); } catch { return; }
    const re = /\.command\(\s*['"]([^'"]+)['"]/g;
    let m;
    while ((m = re.exec(txt)) !== null) {
      const cmd = (m[1] || '').trim();
      if (cmd && !cmd.includes(' ')) commands.add(cmd);
    }
  }

  function walk(dir, depth) {
    if (depth > 5) return;
    let dirents;
    try { dirents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const d of dirents) {
      const full = path.join(dir, d.name);
      if (d.isDirectory()) walk(full, depth + 1);
      else if (d.isFile() && d.name.endsWith('.js')) scanFile(full);
    }
  }

  for (const c of candidates) {
    const st = fs.statSync(c);
    if (st.isFile()) scanFile(c);
    else walk(c, 0);
  }

  // keep only plausible commands (avoid garbage tokens)
  const allow = new Set(['modularize', 'bundle', 'docs', 'swagger2']);
  const filtered = Array.from(commands).filter(c => allow.has(c));
  return filtered.sort();
}

function buildExecutionNarrative(manifest) {
  // Prefer declared narrative from manifest if present; otherwise provide a stable, low-risk narrative.
  // Mark as [INFERRED] if not explicitly present.
  const declared = manifest?.data?.execution_narrative;
  if (declared && typeof declared === 'string') {
    return { source: 'declared', confidence: 'high', value: declared };
  }

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

  return { source: 'inferred', confidence: 'medium', value: inferred };
}

function buildInputsOutputs(manifest) {
  // Emit declared IO if present; otherwise infer minimal from common conventions.
  const outputs = [];
  const expected = manifest?.data?.product?.expected_outputs || [];
  for (const item of expected) {
    if (typeof item === 'string') outputs.push({ path: item, description: null, source: 'declared' });
    else if (item && typeof item === 'object') {
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
  for (const cf of configFiles) inputs.push({ kind: 'config', path: cf, required: false, source: 'declared' });
  inputs.push({ kind: 'manifest', path: './ai/manifest.yml', required: false, source: 'declared' });
  inputs.push({ kind: 'openapi_spec', path: '(varies: --build)', required: true, source: 'declared' });

  return { inputs, outputs };
}

function summarizeQuality({ includeDetails, profile }) {
  // Always return a compact binary summary. Details are opt-in.
  const result = {
    knip: { status: 'unknown', reason: null, details_truncated: true, details: null, source: 'measured' },
    dependencyCruiser: { status: 'unknown', reason: null, details_truncated: true, details: null, source: 'measured' },
  };

  // Knip (optional dependency)
  const knipOut = tryExec('npx knip --no-progress');
  if (knipOut.ok) {
    // knip exits 0 with “no issues”; output may be empty or informational
    result.knip.status = 'pass';
    result.knip.reason = 'no issues reported';
    if (includeDetails && profile !== 'llm') {
      result.knip.details_truncated = false;
      result.knip.details = knipOut.out || '(no output)';
    }
  } else {
    result.knip.status = 'fail';
    // keep short: first meaningful line
    const msg = (knipOut.err || knipOut.out || '').split('\n').find(Boolean) || `exit ${knipOut.code}`;
    result.knip.reason = msg.slice(0, 200);
    if (includeDetails && profile !== 'llm') {
      result.knip.details_truncated = false;
      result.knip.details = {
        code: knipOut.code,
        err: (knipOut.err || '').split('\n').slice(0, 80).join('\n'),
        out: (knipOut.out || '').split('\n').slice(0, 80).join('\n'),
      };
    }
  }

  // dependency-cruiser validation (only if config exists)
  if (fileExists(path.join(repoRoot, '.dependency-cruiser.js'))) {
    const depOut = tryExec('npx dependency-cruiser --validate .dependency-cruiser.js bin');
    if (depOut.ok) {
      result.dependencyCruiser.status = 'pass';
      result.dependencyCruiser.reason = 'architecture boundary check passed';
      if (includeDetails && profile !== 'llm') {
        result.dependencyCruiser.details_truncated = false;
        result.dependencyCruiser.details = depOut.out || '(no output)';
      }
    } else {
      result.dependencyCruiser.status = 'fail';
      const msg = (depOut.err || depOut.out || '').split('\n').find(Boolean) || `exit ${depOut.code}`;
      result.dependencyCruiser.reason = msg.slice(0, 200);
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
    result.dependencyCruiser.reason = 'no .dependency-cruiser.js found';
    result.dependencyCruiser.details_truncated = true;
  }

  return result;
}

function summarizeGit({ includeGit, profile }) {
  if (!includeGit) {
    return { source: 'measured', included: false, dirty: null, branch: null, lastCommit: null, statusSummary: null, details: null };
  }

  const branch = tryExec('git rev-parse --abbrev-ref HEAD');
  const lastCommit = tryExec('git log -1 --oneline');
  const status = tryExec('git status --porcelain=v1');

  const statusText = status.ok ? status.out : '';
  const lines = statusText ? statusText.split('\n').filter(Boolean) : [];
  const modified = lines.filter(l => l.startsWith(' M') || l.startsWith('M ')).length;
  const untracked = lines.filter(l => l.startsWith('??')).length;
  const dirty = lines.length > 0;

  // In llm/default we keep it summarized; in debug we can show raw.
  const details = (profile === 'debug') ? statusText : null;

  return {
    source: 'measured',
    included: true,
    branch: branch.ok ? branch.out : null,
    lastCommit: lastCommit.ok ? lastCommit.out : null,
    dirty,
    modified_count: modified,
    untracked_count: untracked,
    statusSummary: dirty ? `${modified} modified, ${untracked} untracked` : 'clean',
    details,
  };
}

function renderMarkdown(doc, { maxLines }) {
  // doc is the canonical JSON object; md is a view.
  const p = doc.declared?.product?.value || {};
  const productName = p.name || doc.inferred?.product?.value?.name || 'Unknown';
  const productType = p.type || doc.inferred?.product?.value?.type || 'node-cli';
  const purpose = p.purpose || doc.inferred?.product?.value?.purpose || '(missing purpose)';

  const declaredIntent = doc.declared?.authoritative_intent?.value || '(missing)';
  const opModel = doc.declared?.operational_model?.value || {};
  const narrative = doc.execution_narrative?.value || '(missing)';

  const commandsDeclared = (doc.declared?.operations?.value?.commands || []).map(c => c.name).filter(Boolean);
  const commandsInferred = doc.inferred?.commands_detected?.value || [];
  const commands = commandsDeclared.length ? commandsDeclared : commandsInferred;

  const arch = doc.measured?.architecture?.value || {};
  const layers = (arch.layers || []).map(l => `- ${l.layer}: \`${l.path}\``).join('\n') || '- (not detected)';
  const ports = arch.ports ? `- ports: \`${arch.ports}\`` : '';
  const adapters = arch.adapters ? `- adapters: \`${arch.adapters}\`` : '';

  const io = doc.declared?.inputs_outputs?.value || { inputs: [], outputs: [] };
  const inputsRows = (io.inputs || []).map(i => {
    const exists = (i.path && i.path.startsWith('./')) ? (fileExists(path.join(repoRoot, i.path.replace(/^\.\//, ''))) ? 'yes' : 'no') : '';
    return `| ${i.kind || ''} | \`${i.path || ''}\` | ${i.required === true ? 'yes' : 'no'} | ${exists} |`;
  }).join('\n');

  const outputsRows = (io.outputs || []).map(o => {
    const exists = (o.path && o.path.startsWith('./')) ? (fileExists(path.join(repoRoot, o.path.replace(/^\.\//, ''))) ? 'yes' : 'no') : '';
    const ga = (o.guaranteed_after_success == null) ? '' : String(o.guaranteed_after_success);
    return `| \`${o.path || ''}\` | ${o.description || ''} | ${ga} | ${exists} |`;
  }).join('\n');

  const inv = doc.inventory?.value || [];
  const invBlock = inv.join('\n');

  const quality = doc.measured?.quality?.value || {};
  const qKnip = quality.knip ? `${quality.knip.status}: ${quality.knip.reason || ''}` : 'unknown';
  const qDep = quality.dependencyCruiser ? `${quality.dependencyCruiser.status}: ${quality.dependencyCruiser.reason || ''}` : 'unknown';

  const git = doc.measured?.git?.value || {};
  const gitSummary = git.included
    ? `branch: ${git.branch || 'unknown'}\nlast commit: ${git.lastCommit || 'unknown'}\nstatus: ${git.statusSummary || 'unknown'}`
    : '(not included)';

  const md = `# AI Context Pack — ${productName}

Generated: ${doc.meta.generated_at}
Repo root: ${doc.meta.repo_root}
Product type: ${productType}

## 1) Authoritative Intent [DECLARED]
${declaredIntent}

## 2) Product summary [DECLARED]
**Name:** ${productName}
**Purpose:** ${purpose}

## 3) Operational Model [DECLARED]
**Inputs (declared):**
- ${(opModel.declared_inputs || []).map(x => `${x.name} (${x.type})`).join('\n- ') || '(missing)'}
**Invariants:**
- ${(opModel.invariants || []).join('\n- ') || '(missing)'}

## 4) Execution Narrative [${doc.execution_narrative?.source?.toUpperCase?.() || 'INFERRED'}]
${narrative}

## 5) Operations / Commands
${(commands || []).map(c => `- \`${c}\``).join('\n') || '- (none detected)'}

## 6) Inputs / Outputs
### Inputs
| kind | path | required | exists |
|---|---|---|---|
${inputsRows || ''}

### Outputs
| path | description | guaranteed_after_success | exists |
|---|---|---|---|
${outputsRows || ''}

## 7) Architecture map (hexagonal) [MEASURED]
${layers}
${ports}
${adapters}

## 8) Structural Inventory (high-signal)
\`\`\`text
${invBlock}
\`\`\`

## 9) Quality gates (summary)
\`\`\`text
knip: ${qKnip}
dependency-cruiser: ${qDep}
\`\`\`

## 10) Ephemeral State (debug-only)
\`\`\`text
git: ${gitSummary}
\`\`\`
`;

  const lines = md.split('\n');
  return lines.slice(0, maxLines).join('\n') + (lines.length > maxLines ? '\n… (truncated by maxLines)' : '');
}

function main() {
  const args = parseArgs(process.argv);

  // Ensure ai/ exists
  const aiDir = path.join(repoRoot, 'ai');
  if (!fileExists(aiDir)) fs.mkdirSync(aiDir, { recursive: true });

  const pkg = summarizePackageJson();
  const manifest = readManifest();
  if (!manifest) {
    console.error('✖ Missing ai/manifest.yml');
    process.exit(1);
  }

  // Canonical JSON document with explicit sources
  const doc = {
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

    declared: {
      product: { source: 'declared', confidence: 'high', value: manifest.data.product || {} },
      authoritative_intent: { source: 'declared', confidence: 'high', value: manifest.data.authoritative_intent?.value || null },
      operational_model: { source: 'declared', confidence: 'high', value: manifest.data.operational_model || {} },
      operations: { source: 'declared', confidence: 'high', value: manifest.data.operations || {} },
      ai_contract: { source: 'declared', confidence: 'high', value: manifest.data.ai_contract || {} },
      inputs_outputs: { source: 'declared', confidence: 'high', value: buildInputsOutputs(manifest) },
      known_ambiguities: { source: 'declared', confidence: 'high', value: manifest.data.ai_contract?.known_ambiguities || manifest.data.known_ambiguities || [] },
    },

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

    measured: {
      architecture: { source: 'measured', confidence: 'high', value: detectHexLayers() },
      quality: { source: 'measured', confidence: 'high', value: summarizeQuality({ includeDetails: args.includeQualityDetails, profile: args.profile }) },
      git: { source: 'measured', confidence: 'high', value: summarizeGit({ includeGit: args.includeGit, profile: args.profile }) },
    },

    execution_narrative: buildExecutionNarrative(manifest),

    inventory: {
      source: 'measured',
      confidence: 'high',
      value: listHighSignalInventory().slice(0, args.maxTreeLines),
      truncated: true,
    },

    package: {
      source: 'measured',
      confidence: 'high',
      value: pkg,
    },
  };

  // Write canonical JSON
  fs.writeFileSync(path.join(aiDir, 'context.json'), JSON.stringify(doc, null, 2), 'utf8');

  // Write Markdown view
  const md = renderMarkdown(doc, { maxLines: args.maxLines });
  fs.writeFileSync(path.join(aiDir, 'context.md'), md, 'utf8');

  console.log('✔ Wrote ai/context.json (canonical)');
  console.log('✔ Wrote ai/context.md (view)');
  console.log(`ℹ profile=${args.profile} maxLines=${args.maxLines} maxTreeLines=${args.maxTreeLines}`);
}

main();
