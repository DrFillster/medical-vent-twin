'use strict';

const assert=require('node:assert/strict');
const {
  createUrsinoMagosso2000ExpandedPlantRuntime,
}=require('../src/ursino_magosso_2000_expanded_plant_runtime.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}

test('expanded source plant is candidate-only and starts with exact blood-volume closure',()=>{
  const r=createUrsinoMagosso2000ExpandedPlantRuntime({dtSec:0.002});
  const s=r.snapshot();
  assert.equal(s.authority,'candidate-not-canonical');
  assert.equal(s.canonicalControlAuthority,false);
  assert.equal(s.controllerIntegration,'none-plant-only');
  assert(Math.abs(s.conservation.errorMl)<1e-9);
});

test('expanded source plant advances finite five-bed hemodynamics',()=>{
  const r=createUrsinoMagosso2000ExpandedPlantRuntime({dtSec:0.002});
  const s=r.runFor(1);
  for(const key of [
    'systemicArterialPressureMmHg',
    'systemicPeripheralPressureMmHg',
    'splanchnicVenousPressureMmHg',
    'extrasplanchnicVenousPressureMmHg',
    'muscleVenousPressureMmHg',
    'cerebralVenousPressureMmHg',
    'coronaryVenousPressureMmHg',
    'pulmonaryArteryPressureMmHg',
    'rightAtrialPressureMmHg',
    'leftAtrialPressureMmHg',
    'leftVentricleOutflowMlPerSec',
  ]){
    assert(Number.isFinite(s.hemodynamics[key]),key);
  }
  assert(Math.abs(s.conservation.errorMl)<1e-7);
});

test('blood-volume closure remains exact after a longer integration',()=>{
  const r=createUrsinoMagosso2000ExpandedPlantRuntime({dtSec:0.002});
  const s=r.runFor(20);
  assert(Math.abs(s.conservation.errorMl)<1e-6);
});

test('source blood withdrawal changes Vt without scripted pressure correction',()=>{
  const r=createUrsinoMagosso2000ExpandedPlantRuntime({dtSec:0.002});
  const before=r.snapshot().conservation.sourceTotalBloodVolumeMl;
  r.withdrawBloodMl(530);
  const after=r.snapshot();
  assert.equal(after.conservation.sourceTotalBloodVolumeMl,before-530);
  assert(Math.abs(after.conservation.errorMl)<1e-7);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
