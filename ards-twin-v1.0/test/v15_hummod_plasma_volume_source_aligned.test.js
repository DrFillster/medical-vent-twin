'use strict';
const assert=require('node:assert/strict');
const {
  initialPlasmaVolumeMl,
  plasmaVolumeLiters,
  plasmaVolumeMassDerivative,
}=require('../src/hummod_plasma_volume_source_aligned.js');

assert.equal(initialPlasmaVolumeMl({
  initialPvCrit:0.55,
  initialBloodVolumeMl:5000,
}),2750);
assert.equal(plasmaVolumeLiters({volumeMl:2750}),2.75);

const d=plasmaVolumeMassDerivative({
  giLumenAbsorptionMlPerMin:1,
  lymphWaterRateMlPerMin:2,
  ivDripWaterRateMlPerMin:3,
  excessLungWaterFluxMlPerMin:4,
  peritoneumLossMlPerMin:5,
  transfusionPlasmaRateMlPerMin:6,
  collectingDuctWaterOutflowMlPerMin:1,
  capillaryWaterRateMlPerMin:2,
  peritoneumGainMlPerMin:3,
  hemorrhagePlasmaRateMlPerMin:4,
  pericardiumHemorrhagePlasmaFlowMlPerMin:5,
});
assert.equal(d.gainMlPerMin,21);
assert.equal(d.lossMlPerMin,19);
assert.equal(d.changeMlPerMin,2);
assert.equal(d.controlAuthority,false);
console.log('ok - HumMod plasma volume algebra remains source-defined and externally flux-driven');
