'use strict';

const assert=require('node:assert/strict');
const {
  REQUIRED_COLUMNS,
  parseSimpleCsv,
  validateManifest,
  buildSourceStressTrajectory,
}=require('../src/shimayoshi_source_run.js');

const header=REQUIRED_COLUMNS.join(',');
const control=[
  header,
  '0.4,control,10,7.2,0.1,0.05,5,8,1,0.001',
  '0.8,control,10,7.2,0.1,0.05,5,8,1,0.001',
].join('\n');
const challenge=[
  header,
  '0.4,control,8,7.0,0.08,0.04,4.8,7.5,1.2,0.0012',
  '0.8,control,5,6.9,0.04,0.02,4.0,6.0,2.0,0.0013',
].join('\n');

const controlManifest={
  upstreamGitSha:'6478d2ab0acbfc88d3da461d2594658bcb2798ca',
  compilerBuildEnvironment:'test fixture only',
  exactCodeDiff:'output-only instrumentation fixture',
  simulationDuration:'fixture',
  protocolEnabled:'fixture',
  outputCadence:'one row per cycle',
  cvodeTargetCadenceMs:0.1,
  protocolName:'control',
  physiologyChanged:false,
};

const parsed=parseSimpleCsv(control);
assert.equal(parsed.length,2);
assert.equal(parsed[0].protocol,'control');
console.log('ok - Shimayoshi source CSV schema parses exact compact output');

assert.equal(validateManifest(controlManifest).physiologyChanged,false);
assert.throws(
  ()=>validateManifest({...controlManifest,physiologyChanged:true}),
  /physiologyChanged must be false/
);
console.log('ok - source manifest fails closed when physiology was changed');

const challengeManifest={...controlManifest};
const imported=buildSourceStressTrajectory({
  controlCsvText:control,
  challengeCsvText:challenge,
  controlManifest,
  challengeManifest,
});
assert.equal(imported.status,'shimayoshi-source-stress-trajectory-validated');
assert.equal(imported.referencePeakStressMnPerMm2,10);
assert.equal(imported.trajectory[0].stress_ratio,0.8);
assert.equal(imported.trajectory[1].stress_ratio,0.5);
assert.equal(imported.controlAuthority,false);
assert.equal(imported.controlProtocolValidation.status,'source-protocol-trajectory-valid');
console.log('ok - source stress normalizes only to source control force');

const nonMonotonic=[
  header,
  '0.8,control,8,7.0,0.08,0.04,4.8,7.5,1.2,0.0012',
  '0.4,control,5,6.9,0.04,0.02,4.0,6.0,2.0,0.0013',
].join('\n');
assert.throws(
  ()=>buildSourceStressTrajectory({
    controlCsvText:control,
    challengeCsvText:nonMonotonic,
    controlManifest,
    challengeManifest,
  }),
  /time_s must increase strictly/
);
console.log('ok - malformed source time series is rejected');

const contaminatedControl=[
  header,
  '0.4,control,10,7.2,0.1,0.05,5,8,1,0.001',
  '0.8,acidosis,9,7.1,0.1,0.05,5,8,1,0.001',
].join('\n');
assert.throws(
  ()=>buildSourceStressTrajectory({
    controlCsvText:contaminatedControl,
    challengeCsvText:challenge,
    controlManifest,
    challengeManifest,
  }),
  /unexpected source phase acidosis for control trajectory/
);
console.log('ok - contaminated reference control run is rejected');

assert.throws(
  ()=>validateManifest({
    ...controlManifest,
    upstreamGitSha:'abcdef1234567',
  }),
  /must equal pinned Shimayoshi source/
);
console.log('ok - non-pinned upstream source is rejected');

assert.throws(
  ()=>buildSourceStressTrajectory({
    controlCsvText:control,
    challengeCsvText:challenge,
    controlManifest:{...controlManifest,protocolName:'acidosis'},
    challengeManifest,
  }),
  /controlManifest protocolName must be control/
);
console.log('ok - control reference requires independently authenticated control manifest');

const mechanicsHeader=[
  ...REQUIRED_COLUMNS,
  'start_cycle_hsmL_um',
  'min_cycle_hsmL_um',
  'max_cycle_hsmL_um',
  'end_cycle_hsmL_um',
  'end_cycle_hsmX_um',
].join(',');
const mechanicsCsv=[
  mechanicsHeader,
  '0.4,control,6,7.1,0.24,0.23,6.9,10.8,1.8,0.0008,1.04,1.00,1.05,1.03,1.025',
].join('\n');
const mechanicalRow=parseSimpleCsv(mechanicsCsv)[0];
assert.ok(Math.abs(mechanicalRow.cycle_hsmL_excursion_um-0.05)<1e-12);
assert.ok(Math.abs(mechanicalRow.cycle_peak_shortening_um-0.04)<1e-12);
assert.ok(Math.abs(mechanicalRow.cycle_net_hsmL_change_um+0.01)<1e-12);
console.log('ok - optional sarcomere mechanics columns import without changing base schema');

assert.throws(
  ()=>parseSimpleCsv([
    mechanicsHeader,
    '0.4,control,6,7.1,0.24,0.23,6.9,10.8,1.8,0.0008,1.04,1.06,1.05,1.03,1.025',
  ].join('\n')),
  /min_cycle_hsmL_um must be <= max_cycle_hsmL_um/
);
console.log('ok - invalid sarcomere excursion fails closed');

const mechanicsControlCsv=[
  mechanicsHeader,
  '0.4,control,6,7.1,0.24,0.23,6.9,10.8,1.8,0.0008,1.04,1.00,1.05,1.03,1.025',
  '0.8,control,6,7.1,0.24,0.23,6.9,10.8,1.8,0.0008,1.04,1.00,1.05,1.03,1.025',
].join('\n');
const mechanicsChallengeCsv=[
  mechanicsHeader,
  '0.4,control,6,7.1,0.24,0.23,6.9,10.8,1.8,0.0008,1.04,1.02,1.05,1.03,1.025',
].join('\n');
const mechanicalRun=buildSourceStressTrajectory({
  controlCsvText:mechanicsControlCsv,
  challengeCsvText:mechanicsChallengeCsv,
  controlManifest,
  challengeManifest,
});
assert.ok(Math.abs(mechanicalRun.referencePeakShorteningUm-0.04)<1e-12);
assert.ok(Math.abs(mechanicalRun.trajectory[0].shortening_ratio-0.5)<1e-12);
console.log('ok - mechanical shortening normalizes only to independent source control shortening');
