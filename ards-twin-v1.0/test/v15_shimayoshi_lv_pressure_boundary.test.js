'use strict';

const assert=require('node:assert/strict');
const {REQUIRED_COLUMNS,buildSourceStressTrajectory}=
  require('../src/shimayoshi_source_run.js');
const {leftVentricularSourcePressureBoundary}=
  require('../src/shimayoshi_lv_pressure_boundary.js');

const header=REQUIRED_COLUMNS.join(',');
const control=[
  header,
  '0.4,control,10,7.2,0.1,0.05,5,8,1,0.001',
  '0.8,control,10,7.2,0.1,0.05,5,8,1,0.001',
].join('\n');
const manifest={
  upstreamGitSha:'abcdef1234567',
  compilerBuildEnvironment:'fixture',
  exactCodeDiff:'fixture',
  simulationDuration:'fixture',
  protocolEnabled:'control fixture',
  outputCadence:'one row per cycle',
  protocolName:'control',
  physiologyChanged:false,
};
const run=buildSourceStressTrajectory({
  controlCsvText:control,
  challengeCsvText:control,
  manifest,
});

const boundary=leftVentricularSourcePressureBoundary({
  lvVolumeMl:120,
  validatedSourceRun:run,
  cycleIndex:0,
});

assert.equal(boundary.mode,'pressure-driven-left-ventricle');
assert.equal(boundary.requiresPressureDrivenPump,true);
assert.equal(boundary.controlAuthority,false);
assert.equal(boundary.contractilityMultiplier,null);
assert.ok(Number.isFinite(boundary.lvPressureMmHg));
assert.equal(boundary.sourceCellularActiveStressMnPerMm2,10);
console.log('ok - Shimayoshi/Kato source mechanics expose pressure boundary, not contractility multiplier');
