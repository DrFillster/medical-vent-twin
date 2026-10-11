'use strict';
const assert=require('node:assert/strict');
const {
  FAST_INITIAL_MASS,
  SLOW_INITIAL_MASS,
  adhOsmEffect,
  adhNeuralEffect,
  adhSynthesisRate,
  adhSecretionRate,
  adhStorageMassDerivatives,
  adhPoolConcentration,
  adhClearance,
}=require('../src/hummod_adh_source_aligned.js');

assert.equal(adhOsmEffect(0.243),0);
assert.equal(adhOsmEffect(0.253),1);
assert.equal(adhOsmEffect(0.263),5);
assert.equal(adhNeuralEffect(0.5),0.4);
assert.equal(adhNeuralEffect(1.0),1);
assert.equal(adhNeuralEffect(1.2),2);
assert.equal(adhNeuralEffect(1.5),20);
assert.equal(adhSynthesisRate({slowMass:17000}).rate,3.2);

const secretion=adhSecretionRate({
  fastMass:FAST_INITIAL_MASS,
  bodyOsm:0.253,
  osmoreceptors:0,
  pituitaryNa:1,
});
assert.equal(secretion.rate,3.2);

const d=adhStorageMassDerivatives({
  fastMass:FAST_INITIAL_MASS,
  slowMass:SLOW_INITIAL_MASS,
  secretionRate:3.2,
});
assert(Number.isFinite(d.fastChange));
assert(Number.isFinite(d.slowChange));

const pool=adhPoolConcentration({poolMass:30,ecfvL:15});
assert.equal(pool.pgPerMl,2);
assert.equal(pool.log10Conc,Math.log10(2));

const cl=adhClearance({
  adhPgPerMl:2,
  liverBloodFlowMlPerMin:1000,
  kidneyBloodFlowMlPerMin:1000,
  otherTissueBloodFlowMlPerMin:1000,
});
assert(Math.abs(cl.total-4.34)<1e-12);
console.log('ok - HumMod ADH storage, secretion, pool, and clearance algebra remain source-driven');
