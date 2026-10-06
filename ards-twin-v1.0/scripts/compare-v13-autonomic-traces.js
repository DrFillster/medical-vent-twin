#!/usr/bin/env node
'use strict';

const fs = require('node:fs');

const nativePath = process.argv[2];
const reducedPath = process.argv[3];
const outputPath = process.argv[4];
if (!nativePath || !reducedPath || !outputPath) {
  throw new Error('usage: node scripts/compare-v13-autonomic-traces.js <native.json> <reduced.json> <output.json>');
}

const native = JSON.parse(fs.readFileSync(nativePath,'utf8'));
const reduced = JSON.parse(fs.readFileSync(reducedPath,'utf8'));

const diag = native.nativeSolution?.autonomicDiagnostics || native.autonomicDiagnostics || {};
if (!Array.isArray(reduced.rows)) throw new Error('reduced trace rows required');

const stageMap = [
  ['Brain-Fuel.FractUseDelay', null, 'brainFuelFractUseDelay'],
  ['A2Pool.Log10Conc', null, 'a2PoolLog10Conc'],
  ['SympsCNS.ReflexNA', 'sympsCnsReflexNa', 'sympsCnsReflexNa'],
  ['SympsCNS.NA', 'sympsCnsNa', 'sympsCnsNa'],
  ['SympsCNS.NA(Hz)', 'sympsCnsHz', 'sympsCnsHz'],
  ['VagusNerve.NA(Hz)', 'vagusHz', 'vagusHz'],
  ['SANode-BetaReceptors.Activity', 'saBetaActivity', 'saBetaActivity'],
  ['SANode-Rate.ParasympatheticEffect', 'parasympatheticEffectPerMin', 'parasympatheticEffectPerMin'],
  ['SANode-Rate.SympatheticEffect', 'sympatheticEffectPerMin', 'sympatheticEffectPerMin'],
  ['SANode-Rate.Rate', 'sourceSaNodeHrPerMin', 'sourceSaNodeHrPerMin'],
  ['Heart-Rate.Rate', 'hrPerMin', 'hrPerMin'],
];

function finalNative(symbol) {
  const row = diag[symbol];
  return row && typeof row.final === 'number' && Number.isFinite(row.final) ? row.final : null;
}
function peakReduced(field) {
  if (!field) return null;
  let best = null;
  for (const row of reduced.rows) {
    const v = row[field];
    if (typeof v === 'number' && Number.isFinite(v) && (best == null || v > best)) best = v;
  }
  return best;
}

const stages = stageMap.map(([nativeSymbol,reducedField,label]) => ({
  label,
  nativeSymbol,
  reducedField,
  nativeFinal: finalNative(nativeSymbol),
  reducedPeak: peakReduced(reducedField),
}));

let firstComparableDivergence = null;
for (const stage of stages) {
  if (stage.nativeFinal == null || stage.reducedPeak == null) continue;
  const absoluteDelta = stage.reducedPeak - stage.nativeFinal;
  const relativeDelta = stage.nativeFinal === 0 ? null : absoluteDelta / Math.abs(stage.nativeFinal);
  stage.absoluteDelta = absoluteDelta;
  stage.relativeDelta = relativeDelta;
  if (firstComparableDivergence == null && relativeDelta != null && Math.abs(relativeDelta) > 0.10) {
    firstComparableDivergence = stage.label;
  }
}

const report = {
  schema:'vent-v1.3-native-vs-reduced-autonomic-comparison/v1',
  interpretation:{
    purpose:'Locate the first material divergence in the HumMod sympathetic-CNS to SA-node chain.',
    tolerancePolicy:'10% relative difference is a diagnostic flag only; it is not a clinical equivalence threshold.',
    firstComparableDivergence,
    noGainTuning:true,
    clinicalValidation:false,
  },
  stages,
};

fs.writeFileSync(outputPath, JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
