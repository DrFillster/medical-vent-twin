'use strict';

const assert=require('node:assert/strict');
const {
  REQUIRED_COLUMNS,
  buildSourceStressTrajectory,
}=require('../src/shimayoshi_source_run.js');
const {
  myocardialPressureFromValidatedSourceCycle,
}=require('../src/shimayoshi_myocardial_adapter.js');

const header=REQUIRED_COLUMNS.join(',');
const control=[
  header,
  '0.4,control,10,7.2,0.1,0.05,5,8,1,0.001',
  '0.8,control,10,7.2,0.1,0.05,5,8,1,0.001',
].join('\n');
const challenge=[
  header,
  '0.4,source-protocol,8,7.0,0.08,0.04,4.8,7.5,1.2,0.0012',
].join('\n');
const manifest={
  upstreamGitSha:'abcdef1234567',
  compilerBuildEnvironment:'test fixture only',
  exactCodeDiff:'output-only instrumentation fixture',
  simulationDuration:'fixture',
  protocolEnabled:'fixture',
  outputCadence:'one row per cycle',
  physiologyChanged:false,
};

const sourceRun=buildSourceStressTrajectory({
  controlCsvText:control,
  challengeCsvText:challenge,
  manifest,
});
const out=myocardialPressureFromValidatedSourceCycle({
  lvVolumeMl:120,
  validatedSourceRun:sourceRun,
  cycleIndex:0,
});

assert.equal(out.status,'source-stress-to-LV-pressure-shadow-complete');
assert.equal(out.sourceCellularActiveStressMnPerMm2,8);
assert.equal(out.sourceStressProvenance.stressRatio,0.8);
assert.equal(out.sourceStressProvenance.physiologyChanged,false);
assert.ok(Number.isFinite(out.lvPressureMmHg));
console.log('ok - only validated source cycle enters myocardial LV pressure shadow');

assert.throws(
  ()=>myocardialPressureFromValidatedSourceCycle({
    lvVolumeMl:120,
    validatedSourceRun:{trajectory:[{peak_Fb_mN_per_mm2:8}]},
    cycleIndex:0,
  }),
  /validated Shimayoshi source run is required/
);
console.log('ok - arbitrary unvalidated stress object is rejected');
