'use strict';
const assert=require('node:assert/strict');
const {
  OUTFLOW_KEYS,
  lactatePoolConcentration,
  lactatePoolMassDerivative,
}=require('../src/hummod_lactate_pool_source_aligned.js');

const c=lactatePoolConcentration({massMeq:15,ecfvMl:15000});
assert.equal(c.concentrationMeqPerL,1);

const flows=Object.fromEntries(OUTFLOW_KEYS.map(k=>[k,1]));
const d=lactatePoolMassDerivative({
  tissueOutflowsMeqPerMin:flows,
  pumpRateMeqPerMin:2,
});
assert.equal(d.tissueOutflowTotalMeqPerMin,12);
assert.equal(d.changeMeqPerMin,14);

const incomplete={...flows};
delete incomplete.brain;
assert.throws(
  ()=>lactatePoolMassDerivative({tissueOutflowsMeqPerMin:incomplete}),
  /missing: brain/
);
console.log('ok - LacPool requires all source tissue outflows and does not infer missing organ flux');
