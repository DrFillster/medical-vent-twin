'use strict';

const assert=require('node:assert/strict');
const {
  initialDynamicPressureShadowState,
  advanceDynamicAcidosisPressureShadow,
}=require('../src/shimayoshi_acidosis_dynamic_pressure_shadow.js');

let state=initialDynamicPressureShadowState();

const baseline=advanceDynamicAcidosisPressureShadow({
  state,
  sourceCo2Percent:5,
  dtSec:1,
  lvVolumeMl:120,
});
assert.equal(baseline.closedLoopPressureAuthority,false);
assert.equal(baseline.controlAuthority,false);
assert(Number.isFinite(baseline.lvPressureMmHg));

state={myocardial:baseline.myocardial};

let challenged=null;
for(let i=0;i<120;i++){
  challenged=advanceDynamicAcidosisPressureShadow({
    state,
    sourceCo2Percent:25,
    dtSec:1,
    lvVolumeMl:120,
  });
  state={myocardial:challenged.myocardial};
}
assert(challenged.stressRatio<baseline.stressRatio);
assert(challenged.lvPressureMmHg<baseline.lvPressureMmHg);
assert.equal(challenged.pressureShadow.controlAuthority,false);

let recovery=null;
for(let i=0;i<60;i++){
  recovery=advanceDynamicAcidosisPressureShadow({
    state,
    sourceCo2Percent:5,
    dtSec:1,
    lvVolumeMl:120,
  });
  state={myocardial:recovery.myocardial};
}
assert(recovery.stressRatio>challenged.stressRatio);
assert.equal(recovery.closedLoopPressureAuthority,false);
console.log('ok - blind-validated dynamic source response propagates through LV pressure shadow only');
