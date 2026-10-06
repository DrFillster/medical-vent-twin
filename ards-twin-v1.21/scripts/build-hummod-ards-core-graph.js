'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  HUMMOD_ARDS_CORE,
  HUMMOD_ARDS_CORE_PHASE1_POLICY,
  hummodArdsCoreRootStructures,
} = require('../src/hummod_ards_core_manifest.js');

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--hummod-root') out.hummodRoot = argv[++i];
    else if (arg === '--out') out.out = argv[++i];
    else if (arg === '--max-depth') out.maxDepth = Number(argv[++i]);
    else throw new Error('unknown argument: ' + arg);
  }
  if (!out.hummodRoot) throw new Error('--hummod-root is required');
  if (!out.out) out.out = path.resolve('hummod-ards-core-graph.json');
  if (!Number.isFinite(out.maxDepth)) out.maxDepth = 50;
  return out;
}

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(p));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.des')) files.push(p);
  }
  return files;
}

function structureName(text) {
  const m = text.match(/<structure>\s*<name>\s*([^<]+?)\s*<\/name>/i);
  return m ? m[1].trim() : null;
}

function referencedStructures(text, selfName) {
  const deps = new Set();
  const tokenRe = /\b([A-Za-z][A-Za-z0-9_-]*)\.([A-Za-z0-9_\-\[\]\(\)%+]+)\b/g;
  let m;
  while ((m = tokenRe.exec(text))) {
    if (m[1] !== selfName) deps.add(m[1]);
  }

  const callRe = /<call>\s*([A-Za-z][A-Za-z0-9_-]*)\.[^<]+<\/call>/gi;
  while ((m = callRe.exec(text))) {
    if (m[1] !== selfName) deps.add(m[1]);
  }
  return [...deps].sort();
}

function buildIndex(root) {
  const index = new Map();
  const duplicateNames = new Map();
  for (const file of walk(root)) {
    const text = fs.readFileSync(file, 'utf8');
    const name = structureName(text);
    if (!name) continue;
    const item = {
      structure: name,
      path: path.relative(root, file).replace(/\\/g, '/'),
      dependencies: referencedStructures(text, name),
    };
    if (index.has(name)) {
      if (!duplicateNames.has(name)) duplicateNames.set(name, [index.get(name).path]);
      duplicateNames.get(name).push(item.path);
      continue;
    }
    index.set(name, item);
  }
  return { index, duplicateNames };
}

function dependencyClosure(index, roots, maxDepth, policy = null) {
  const seen = new Map();
  const missing = new Set();
  const frontier = [];
  const queue = roots.map(root => ({ name: root, depth: 0, parent: null }));

  const stopBuckets = new Set(policy?.stopSystemBuckets || []);
  const laterBuckets = new Set(policy?.laterPhaseSystemBuckets || []);
  const stopStructures = new Set(policy?.stopStructureNames || []);

  while (queue.length) {
    const current = queue.shift();
    if (seen.has(current.name) && seen.get(current.name).depth <= current.depth) continue;
    const item = index.get(current.name);
    if (!item) {
      missing.add(current.name);
      continue;
    }

    const bucket = systemBucket(item.path);
    const boundaryKind = stopStructures.has(current.name)
      ? 'explicit-structure-boundary'
      : stopBuckets.has(bucket)
        ? 'phase1-externalized-system'
        : laterBuckets.has(bucket)
          ? 'later-phase-system'
          : null;

    seen.set(current.name, {
      ...item,
      depth: current.depth,
      firstParent: current.parent,
      systemBucket: bucket,
      boundaryKind,
    });

    if (boundaryKind) {
      frontier.push({
        structure: current.name,
        path: item.path,
        systemBucket: bucket,
        depth: current.depth,
        firstParent: current.parent,
        boundaryKind,
      });
      continue;
    }

    if (current.depth >= maxDepth) continue;
    for (const dep of item.dependencies) {
      queue.push({ name: dep, depth: current.depth + 1, parent: current.name });
    }
  }

  return {
    structures: [...seen.values()].sort((a,b) => a.depth - b.depth || a.structure.localeCompare(b.structure)),
    missing: [...missing].sort(),
    frontier: frontier.sort((a,b) => a.depth - b.depth || a.structure.localeCompare(b.structure)),
  };
}

function systemBucket(p) {
  const parts = p.split('/');
  if (parts[0] === 'Structure' && parts.length > 1) return parts[1];
  if (parts[0] === 'Context' && parts.length > 1) return 'Context/' + parts[1];
  return parts[0] || 'unknown';
}

function summarize(structures) {
  const bySystem = {};
  for (const s of structures) {
    const bucket = systemBucket(s.path);
    bySystem[bucket] = (bySystem[bucket] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(bySystem).sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0])));
}

function main() {
  const args = parseArgs(process.argv);
  const hummodRoot = path.resolve(args.hummodRoot);
  const { index, duplicateNames } = buildIndex(hummodRoot);
  const roots = hummodArdsCoreRootStructures();
  const fullClosure = dependencyClosure(index, roots, args.maxDepth);
  const phase1Closure = dependencyClosure(
    index, roots, args.maxDepth, HUMMOD_ARDS_CORE_PHASE1_POLICY);

  const result = {
    schema: 'hummod-ards-core-dependency-graph/v1',
    source: HUMMOD_ARDS_CORE.source,
    generatedFrom: hummodRoot,
    rootSymbols: HUMMOD_ARDS_CORE.outputs.map(x => x.symbol),
    rootStructures: roots,
    structureCountIndexed: index.size,
    fullClosure: {
      structureCount: fullClosure.structures.length,
      systems: summarize(fullClosure.structures),
      missingStructures: fullClosure.missing,
    },
    phase1Policy: HUMMOD_ARDS_CORE_PHASE1_POLICY,
    phase1Closure: {
      structureCount: phase1Closure.structures.length,
      systems: summarize(phase1Closure.structures),
      missingStructures: phase1Closure.missing,
      frontierCount: phase1Closure.frontier.length,
      frontier: phase1Closure.frontier,
      structures: phase1Closure.structures,
    },
    duplicateStructureNames: Object.fromEntries(duplicateNames),
    interpretation: {
      status: 'static-source-dependency-closure-not-runnable-submodel',
      note: 'This graph identifies source dependency breadth. It does not prove that copying the listed files yields an independently solvable HumMod subset.',
    },
  };

  fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
  fs.writeFileSync(path.resolve(args.out), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({
    out: path.resolve(args.out),
    roots: roots.length,
    indexed: index.size,
    fullClosure: fullClosure.structures.length,
    phase1Closure: phase1Closure.structures.length,
    phase1Frontier: phase1Closure.frontier.length,
    missing: phase1Closure.missing.length,
    phase1TopSystems: Object.entries(result.phase1Closure.systems).slice(0, 12),
  }, null, 2));
}

if (require.main === module) main();

module.exports = {
  structureName,
  referencedStructures,
  buildIndex,
  dependencyClosure,
  summarize,
};
