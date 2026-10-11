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
  '0.4,control,8,7.0,0.08,0.04,4.8,7.5,1.2,0.0012',
].join('\n');
const controlManifest={
  upstreamGitSha:'6478d2ab0acbfc88d3da461d2594658bcb2798ca',
  compilerBuildEnvironment:'test fixture only',
  exactCodeDiff:'output-only instrumentation fixture',
  simulationDuration:'fixture',
  protocolEnabled:'fixture',
  outputCadence:'one row per cycle',
  protocolName:'control',
  physiologyChanged:false,
};
const challengeManifest={...controlManifest};

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
assert.equal(out.sourceStressProvenance.sourceProtocolName,'control');
assert.equal(out.sourceStressProvenance.protocolValidationStatus,'source-protocol-trajectory-valid');
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

const zeroChallenge=[
  header,
  '0.4,control,0,6.5,0.001,0.0001,2.0,1.0,8.0,0.0002',
].join('\n');
const zeroRun=buildSourceStressTrajectory({
  controlCsvText:control,
  challengeCsvText:zeroChallenge,
  manifest,
});
const zeroOut=myocardialPressureFromValidatedSourceCycle({
  lvVolumeMl:120,
  validatedSourceRun:zeroRun,
  cycleIndex:0,
});
assert.equal(zeroOut.sourceCellularActiveStressMnPerMm2,0);
assert.equal(zeroOut.sourceStressProvenance.stressRatio,0);
assert.ok(Number.isFinite(zeroOut.lvPressureMmHg));
console.log('ok - terminal zero active stress propagates through passive LV pressure only');
