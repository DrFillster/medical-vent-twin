'use strict';

const assert=require('node:assert/strict');
const {
  createPhysicianValidationCandidate,
}=require('../src/physician_validation_candidate.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}

test('physician validation candidate remains parallel and non-canonical',()=>{
  const r=createPhysicianValidationCandidate({
    dtSec:0.002,pao2MmHg:95,paco2MmHg:40,tidalVolumeL:0.5,
  });
  r.runFor(2);
  const s=r.snapshot();
  assert.equal(s.authority,'candidate-not-canonical');
  assert.equal(s.canonicalControlAuthority,false);
  assert.equal(s.candidatePlantControlAuthority,true);
  assert(Number.isFinite(s.heartRatePerMin));
  assert(Number.isFinite(s.meanArterialPressureMmHg));
  assert(Number.isFinite(s.cardiacOutputMlPerMin));
  assert(Number.isFinite(s.strokeVolumeMl));
  assert(Number.isFinite(s.systemicPeripheralResistanceMmHgMinPerL));
  assert.equal(s.averaging.method,'time-average-of-pulsatile-candidate-output');
  assert(Array.isArray(s.knownLimitations));
  assert(s.knownLimitations.length>=3);
});

test('gas and delivered-VT inputs change the candidate without granting authority',()=>{
  const r=createPhysicianValidationCandidate({
    dtSec:0.002,pao2MmHg:95,paco2MmHg:40,tidalVolumeL:0.5,
  });
  r.runFor(10);
  const baseline=r.snapshot();
  r.setEnvironment({pao2MmHg:50,paco2MmHg:60,tidalVolumeL:0.45});
  r.runFor(20);
  const stressed=r.snapshot();

  assert.notEqual(stressed.heartRatePerMin,baseline.heartRatePerMin);
  assert.notEqual(stressed.meanArterialPressureMmHg,baseline.meanArterialPressureMmHg);
  assert.equal(stressed.canonicalControlAuthority,false);
  assert.equal(stressed.inputs.tidalVolumeL,0.45);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
