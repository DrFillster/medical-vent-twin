'use strict';
const assert=require('node:assert/strict');
const y=require('../src/yamanaka_sepsis_shadow.js');

const params={laMax:6,laMin:1,ec50La:2,slopeLa:2};
assert.equal(y.capillaryPermeabilityFromInflammation(0,params),1);
assert.ok(
  y.capillaryPermeabilityFromInflammation(4,params)>
  y.capillaryPermeabilityFromInflammation(1,params)
);

const ex1=y.vasodilationDecrementFromInflammation(1,{
  kEx:2,ec50Ex:2,slopeEx:2,
});
const ex2=y.vasodilationDecrementFromInflammation(4,{
  kEx:2,ec50Ex:2,slopeEx:2,
});
assert.ok(ex2>ex1);

const sv0=y.strokeVolumeFromInflammation(0,{
  normalStrokeVolumeMl:70,
  kS:1,
  antiInflammatoryMediator:0,
  cInfinity:1,
});
assert.equal(sv0,70);
const sv1=y.strokeVolumeFromInflammation(2,{
  normalStrokeVolumeMl:70,
  kS:1,
  antiInflammatoryMediator:0,
  cInfinity:1,
});
assert.ok(sv1<70);

assert.equal(
  y.sympatheticFatigueDerivative(1,{normalActivity:1,tauGamma:10}),
  0
);
assert.ok(
  y.sympatheticFatigueDerivative(2,{normalActivity:1,tauGamma:10})>0
);

console.log('ok - Yamanaka source equations remain parameterized shadow functions');
