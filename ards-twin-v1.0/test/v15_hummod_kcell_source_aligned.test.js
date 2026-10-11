'use strict';
const assert=require('node:assert/strict');
const {
  TARGET_K_MEQ_PER_ML,
  initialKCellMassMeq,
  kCellConcentration,
  kCellMassDerivative,
}=require('../src/hummod_kcell_source_aligned.js');

assert.equal(initialKCellMassMeq({initialIcfvMl:1000}),142);
const c=kCellConcentration({massMeq:142,cellWaterMl:1000});
assert.equal(c.concentrationMeqPerMl,TARGET_K_MEQ_PER_ML);
assert.equal(c.concentrationMeqPerL,142);
assert.equal(kCellMassDerivative({gainMeqPerMin:3,lossMeqPerMin:2}),1);
assert.equal(c.controlAuthority,false);
console.log('ok - KCell source algebra preserves mass-to-cell-water concentration without assumed live state');
