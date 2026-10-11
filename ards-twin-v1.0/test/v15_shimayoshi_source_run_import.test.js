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

const manifest={
  upstreamGitSha:'abcdef1234567',
  compilerBuildEnvironment:'test fixture only',
  exactCodeDiff:'output-only instrumentation fixture',
  simulationDuration:'fixture',
  protocolEnabled:'fixture',
  outputCadence:'one row per cycle',
  protocolName:'control',
  physiologyChanged:false,
};

const parsed=parseSimpleCsv(control);
assert.equal(parsed.length,2);
assert.equal(parsed[0].protocol,'control');
console.log('ok - Shimayoshi source CSV schema parses exact compact output');

assert.equal(validateManifest(manifest).physiologyChanged,false);
assert.throws(
  ()=>validateManifest({...manifest,physiologyChanged:true}),
  /physiologyChanged must be false/
);
console.log('ok - source manifest fails closed when physiology was changed');

const imported=buildSourceStressTrajectory({
  controlCsvText:control,
  challengeCsvText:challenge,
  manifest,
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
    manifest,
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
    manifest,
  }),
  /unexpected source phase acidosis for control trajectory/
);
console.log('ok - contaminated reference control run is rejected');
