'use strict';

const assert=require('node:assert/strict');
const {
  createHumModDynamicAcidosisPressureShadow,
}=require('../src/shimayoshi_hummod_dynamic_acidosis_pressure_shadow.js');

const x=createHumModDynamicAcidosisPressureShadow();

const baseline=x.step({
  dtSec:0.4,
  myocardialPco2MmHg:39.5,
  lvVolumeMl:120,
});
assert.equal(baseline.sourceEquivalentCo2Percent,5);
assert.equal(baseline.closedLoopPressureAuthority,false);
assert(Number.isFinite(baseline.lvPressureMmHg));

let high=null;
for(let i=0;i<300;i++){
  high=x.step({
    dtSec:0.4,
    myocardialPco2MmHg:158,
    lvVolumeMl:120,
  });
}
assert.equal(high.sourceEquivalentCo2Percent,20);
assert(high.stressRatio<1);
assert(high.lvPressureMmHg<baseline.lvPressureMmHg);
console.log('ok - HumMod myocardial PCO2 drives dynamic Shimayoshi pressure shadow through dimensional bridge');

const beforeRecovery=high.stressRatio;
const recovery=x.step({
  dtSec:0.4,
  myocardialPco2MmHg:39.5,
  lvVolumeMl:120,
});
assert(recovery.stressRatio>=beforeRecovery);
assert.notEqual(recovery.stressRatio,1);
console.log('ok - dynamic pressure shadow preserves myocardial exposure history during recovery');

const blocked=x.step({
  dtSec:0.4,
  myocardialPco2MmHg:250,
  lvVolumeMl:120,
});
assert.equal(blocked.pressureShadowEligible,false);
assert.equal(blocked.lvPressureMmHg,null);
assert.equal(blocked.closedLoopPressureAuthority,false);
console.log('ok - dynamic pressure shadow fails closed outside source CO2 domain');
