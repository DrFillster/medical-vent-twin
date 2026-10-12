'use strict';

const assert=require('node:assert/strict');
const {
  createUrsinoMagosso2000PlantRuntime,
}=require('../src/ursino_magosso_2000_plant_runtime.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}

test('five-bed plant advances finite hemodynamics with local O2 disabled',()=>{
  const r=createUrsinoMagosso2000PlantRuntime({dtSec:0.002});
  const s=r.runFor(1);
  for(const v of [
    s.hemodynamics.systemicArterialPressureMmHg,
    s.hemodynamics.systemicPeripheralPressureMmHg,
    s.hemodynamics.pulmonaryArteryPressureMmHg,
    s.hemodynamics.rightAtrialPressureMmHg,
    s.hemodynamics.leftAtrialPressureMmHg,
    s.hemodynamics.extrasplanchnicVenousPressureMmHg,
    s.hemodynamics.heartRatePerMin,
  ]) assert(Number.isFinite(v));
  for(const v of Object.values(s.hemodynamics.regionalFlows)){
    assert(Number.isFinite(v));
  }
  assert.equal(s.localO2Authority,false);
  assert.equal(s.canonicalControlAuthority,false);
});

test('right atrial return includes all five source systemic venous branches',()=>{
  const r=createUrsinoMagosso2000PlantRuntime({dtSec:0.002});
  const s=r.snapshot();
  const keys=Object.keys(s.hemodynamics.regionalFlows);
  for(const key of [
    'splanchnicVenousMlPerSec',
    'extrasplanchnicVenousMlPerSec',
    'muscleVenousMlPerSec',
    'brainVenousMlPerSec',
    'coronaryVenousMlPerSec',
  ]) assert(keys.includes(key),key);
});

test('external source effectors can control the candidate plant without canonical authority',()=>{
  const r=createUrsinoMagosso2000PlantRuntime({dtSec:0.002});
  const a=r.snapshot();
  r.setEffectors({
    Rsp:a.effectors.Rsp*1.01,
    Rep:a.effectors.Rep*1.01,
    Rmp:a.effectors.Rmp*1.01,
  });
  const b=r.runFor(0.2);
  assert.equal(b.authority,'candidate-not-canonical');
  assert.equal(b.canonicalControlAuthority,false);
  assert(Number.isFinite(b.hemodynamics.systemicArterialPressureMmHg));
});

test('brain and coronary resistance remain explicit external plant inputs',()=>{
  const r=createUrsinoMagosso2000PlantRuntime({dtSec:0.002});
  const a=r.snapshot();
  r.setEffectors({
    Rbp:a.effectors.Rbp*0.9,
    Rhp:a.effectors.Rhp*0.9,
  });
  const b=r.runFor(0.2);
  assert(b.effectors.Rbp<a.effectors.Rbp);
  assert(b.effectors.Rhp<a.effectors.Rhp);
  assert.equal(b.localO2Authority,false);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
