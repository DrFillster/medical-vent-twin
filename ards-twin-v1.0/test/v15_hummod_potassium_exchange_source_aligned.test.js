'use strict';
const assert=require('node:assert/strict');
const {
  potassiumFluxToCell,
  potassiumFluxToPool,
  initialKPoolMassMeq,
  potassiumPoolConcentration,
  potassiumPoolMassDerivative,
  potassiumCellMassDerivative,
}=require('../src/hummod_potassium_exchange_source_aligned.js');

const toCell=potassiumFluxToCell({
  kPoolMassMeq:66,
  delayedAldosteroneEffect:1,
});
assert.equal(toCell.rateConstantPerMin,0.002);
assert.equal(toCell.rateMeqPerMin,0.132);

const toPool=potassiumFluxToPool({kCellMassMeq:2280});
assert(Math.abs(toPool.rateMeqPerMin-0.0074)<1e-12);

assert.equal(initialKPoolMassMeq({ecfvMl:15000}),66);
assert.equal(potassiumPoolConcentration({
  massMeq:66,
  initialEcfvMl:15000,
}).concentrationMeqPerL,4.4);

const p=potassiumPoolMassDerivative({
  giAbsorptionMeqPerMin:1,
  fluxToPoolMeqPerMin:2,
  ivDripMeqPerMin:3,
  transfusionMeqPerMin:4,
  collectingDuctOutflowMeqPerMin:1,
  fluxToCellMeqPerMin:2,
  sweatOutflowMeqPerMin:1,
  hemorrhageMeqPerMin:1,
  dialyzerFluxMeqPerMin:1,
});
assert.equal(p.gainMeqPerMin,10);
assert.equal(p.lossMeqPerMin,6);
assert.equal(p.changeMeqPerMin,4);
assert.equal(potassiumCellMassDerivative({
  fluxToCellMeqPerMin:2,
  fluxToPoolMeqPerMin:0.5,
}),1.5);
console.log('ok - HumMod potassium pool/cell exchange algebra is source-aligned and externally flux-driven');
