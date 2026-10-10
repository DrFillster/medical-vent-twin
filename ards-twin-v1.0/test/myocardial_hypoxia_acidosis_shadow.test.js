'use strict';
const assert=require('node:assert/strict');
const {
  ryrPhFactor,
  ncxPhFactor,
  complexIvOxygenFactor,
  candidateSnapshot,
}=require('../src/myocardial_hypoxia_acidosis_shadow.js');

assert.ok(Math.abs(ryrPhFactor(7.15)-1)<1e-12);
assert.ok(Math.abs(ncxPhFactor(7.15)-1)<1e-12);
assert.ok(ryrPhFactor(6.8)<1);
assert.ok(ncxPhFactor(6.8)<1);
assert.equal(complexIvOxygenFactor(0),0);
assert.ok(complexIvOxygenFactor(0.24)>0);
const x=candidateSnapshot({intracellularPh:6.9,intracellularO2Mm:0.1});
assert.ok(x.componentFactors.ryrPh<1);
assert.ok(x.componentFactors.complexIvOxygen>0);
assert.equal(x.wholeHeartContractilityMultiplier,null);
assert.equal(x.controlAuthority,false);
console.log('ok - myocardial hypoxia/acidosis candidate remains mechanistic and fail-closed at Emax');
