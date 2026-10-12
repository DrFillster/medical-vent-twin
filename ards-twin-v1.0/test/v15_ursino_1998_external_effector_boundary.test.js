'use strict';

const assert=require('node:assert/strict');
const {
  createUrsino1998ClosedLoopRuntime,
}=require('../src/ursino_1998_closed_loop_runtime.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}

test('default runtime retains internal Ursino 1998 effector ownership',()=>{
  const r=createUrsino1998ClosedLoopRuntime({dtSec:0.002});
  const s=r.snapshot();
  assert.equal(s.effectorOwnership.mode,'ursino-1998-internal');
  assert.equal(s.effectorOwnership.external,null);
});

test('external source-family effectors can own plant inputs explicitly',()=>{
  const r=createUrsino1998ClosedLoopRuntime({dtSec:0.002});
  const base=r.snapshot().hemodynamics;
  r.setExternalEffectors({
    EmaxLv:base.EmaxLvMmHgPerMl,
    EmaxRv:base.EmaxRvMmHgPerMl,
    Rsp:base.splanchnicResistanceMmHgSecPerMl,
    Rep:base.extrasplanchnicResistanceMmHgSecPerMl,
    Vusv:base.splanchnicVenousUnstressedVolumeMl,
    Vuev:base.extrasplanchnicVenousUnstressedVolumeMl,
    heartPeriodSec:base.heartPeriodSec,
    dVuevDtMlPerSec:0,
  });
  const s=r.snapshot();
  assert.equal(s.effectorOwnership.mode,'external-source-family');
  assert.equal(s.effectorOwnership.external.dVuevDtMlPerSec,0);
  assert.equal(s.authority,'candidate-not-canonical');
});

test('external effectors are held by the plant without advancing internal effector states',()=>{
  const r=createUrsino1998ClosedLoopRuntime({dtSec:0.002});
  const before=r.snapshot();
  const h=before.hemodynamics;
  r.setExternalEffectors({
    EmaxLv:h.EmaxLvMmHgPerMl,
    EmaxRv:h.EmaxRvMmHgPerMl,
    Rsp:h.splanchnicResistanceMmHgSecPerMl,
    Rep:h.extrasplanchnicResistanceMmHgSecPerMl,
    Vusv:h.splanchnicVenousUnstressedVolumeMl,
    Vuev:h.extrasplanchnicVenousUnstressedVolumeMl,
    heartPeriodSec:h.heartPeriodSec,
    dVuevDtMlPerSec:0,
  });
  const controlStateBefore={...r.snapshot().state};
  r.runFor(0.02);
  const after=r.snapshot();
  for(const key of [
    'dEmaxLv','dEmaxRv','dRsp','dRep','dVusv','dVuev','dTs','dTv',
  ]){
    assert.equal(after.state[key],controlStateBefore[key],key+' drifted');
  }
});

test('external Vuev derivative is required and finite',()=>{
  const r=createUrsino1998ClosedLoopRuntime({dtSec:0.002});
  const h=r.snapshot().hemodynamics;
  assert.throws(()=>r.setExternalEffectors({
    EmaxLv:h.EmaxLvMmHgPerMl,
    EmaxRv:h.EmaxRvMmHgPerMl,
    Rsp:h.splanchnicResistanceMmHgSecPerMl,
    Rep:h.extrasplanchnicResistanceMmHgSecPerMl,
    Vusv:h.splanchnicVenousUnstressedVolumeMl,
    Vuev:h.extrasplanchnicVenousUnstressedVolumeMl,
    heartPeriodSec:h.heartPeriodSec,
  }),/dVuevDtMlPerSec/);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
