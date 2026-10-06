#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  validateV11RcProvenanceManifest,
  V11_RC_OUTPUT_PROVENANCE,
} = require('../src/v11_provenance_manifest.js');
const {
  MODEL_PROVENANCE,
  LIVE_CLINICAL_PROVENANCE_IDS,
} = require('../src/model_provenance.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function main() {
  const root = path.resolve(__dirname, '..');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert(pkg.version === '1.1.0-rc.1', 'package version must be 1.1.0-rc.1');

  const gate = validateV11RcProvenanceManifest();
  assert(gate.unknownCount === 0, 'release provenance gate contains UNKNOWN');

  const activeUnknown = LIVE_CLINICAL_PROVENANCE_IDS.filter(
    id => !MODEL_PROVENANCE[id] || MODEL_PROVENANCE[id].class === 'UNKNOWN');
  assert(activeUnknown.length === 0,
    'active live provenance contains missing/UNKNOWN ids: ' + activeUnknown.join(', '));

  assert(Object.keys(V11_RC_OUTPUT_PROVENANCE).length >= 20,
    'monitor-output provenance map is unexpectedly sparse');

  const home = fs.readFileSync(path.join(root, 'web', 'index.html'), 'utf8');
  assert(home.includes('v1.1 RC1'), 'homepage must identify v1.1 RC1');
  assert(home.includes('MODEL_PROVENANCE_AUDIT.md'), 'homepage missing provenance audit link');
  assert(home.includes('HUMMOD_PRODUCTION_RUNTIME_STRATEGY.md'),
    'homepage missing HumMod runtime strategy link');

  const requiredDocs = [
    'MODEL_PROVENANCE_AUDIT.md',
    'PROVENANCE_STANDARD.md',
    'PROVENANCE_IMPLEMENTATION_PLAN.md',
    'HUMMOD_PRODUCTION_RUNTIME_STRATEGY.md',
    'HUMMOD_DES_RUNTIME_SPIKE.md',
    'V2_HUMMOD_CO_SIMULATION.md',
    'V1_1_RELEASE_CANDIDATE.md',
  ];
  for (const name of requiredDocs) {
    assert(fs.existsSync(path.join(root, 'docs', name)), 'missing RC document: ' + name);
  }

  console.log(JSON.stringify({
    releaseCandidate: pkg.version,
    provenanceGate: gate,
    activeLiveProvenanceCount: LIVE_CLINICAL_PROVENANCE_IDS.length,
    monitorOutputProvenanceCount: Object.keys(V11_RC_OUTPUT_PROVENANCE).length,
    status: 'static-rc-gates-passed',
  }, null, 2));
}

if (require.main === module) {
  try { main(); }
  catch (error) {
    console.error('V1.1 RC VERIFY FAILED:', error.message);
    process.exit(1);
  }
}
