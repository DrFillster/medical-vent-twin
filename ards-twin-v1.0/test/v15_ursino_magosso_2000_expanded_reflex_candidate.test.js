'use strict';

const assert=require('node:assert/strict');
const {
  createUrsinoMagosso2000ExpandedReflexCandidate,
}=require('../src/ursino_magosso_2000_expanded_reflex_candidate.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}

test('expanded reflex candidate remains non-canonical with local O2 disabled',()=>{
  const r=createUrsinoMagosso2000ExpandedReflexCandidate({dtSec:0.002});
  const s=r.step();
  assert.equal(s.authority,'candidate-not-canonical');
  assert.equal(s.canonicalControlAuthority,false);
  assert.equal(s.candidatePlantControlAuthority,true);
  assert.equal(s.localO2ControlActive,false);
  assert.equal(s.localO2Ownership,'disabled-in-this-layer');
});

test('expanded reflex candidate advances finite five-bed hemodynamics with volume closure',()=>{
  const r=createUrsinoMagosso2000ExpandedReflexCandidate({dtSec:0.002});
  const s=r.runFor(30);
  for(const key of [
    'systemicArterialPressureMmHg',
    'systemicPeripheralPressureMmHg',
    'splanchnicVenousPressureMmHg',
    'extrasplanchnicVenousPressureMmHg',
    'muscleVenousPressureMmHg',
    'cerebralVenousPressureMmHg',
    'coronaryVenousPressureMmHg',
    'pulmonaryArteryPressureMmHg',
    'heartRatePerMin',
    'leftVentricleOutflowMlPerSec',
  ]){
    assert(Number.isFinite(s.hemodynamics[key]),key);
  }
  assert(Math.abs(s.conservation.errorMl)<1e-6);
});

test('gas stress propagates through source autonomic channels into the expanded plant',()=>{
  const r=createUrsinoMagosso2000ExpandedReflexCandidate({
    dtSec:0.002,pao2MmHg:95,paco2MmHg:40,tidalVolumeL:0.5,
  });
  r.runFor(60);
  const before=r.snapshot();

  r.setEnvironment({pao2MmHg:50,paco2MmHg:60});
  r.runFor(60);
  const after=r.snapshot();

  assert(after.controller);
  assert(Number.isFinite(after.controller.autonomic.fSpSpikesPerSec));
  assert(Number.isFinite(after.controller.autonomic.fShSpikesPerSec));
  assert(Number.isFinite(after.controller.autonomic.fVSpikesPerSec));
  assert.notEqual(
    after.hemodynamics.heartRatePerMin,
    before.hemodynamics.heartRatePerMin
  );
  assert.notEqual(
    after.hemodynamics.systemicArterialPressureMmHg,
    before.hemodynamics.systemicArterialPressureMmHg
  );
  assert(Math.abs(after.conservation.errorMl)<1e-6);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
