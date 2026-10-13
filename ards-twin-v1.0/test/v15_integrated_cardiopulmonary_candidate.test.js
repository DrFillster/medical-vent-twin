'use strict';

const assert=require('node:assert/strict');
const {
  createV15IntegratedCardiopulmonaryCandidate,
}=require('../src/v15_integrated_cardiopulmonary_candidate.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}

let c=null;
let baseline=null;
let challenged=null;

test('integrated candidate is candidate-only and exposes one physician state',()=>{
  c=createV15IntegratedCardiopulmonaryCandidate({dtSec:0.002});
  const s=c.snapshot();
  assert.equal(s.schema,'v15-integrated-cardiopulmonary-candidate/v1');
  assert.equal(s.canonicalControlAuthority,false);
  assert.equal(s.candidatePlantControlAuthority,true);
  assert.equal(s.ownership.ventMechanics,'external-canonical-owner');
  assert.equal(s.ownership.pulmonaryMechanicalCoupling,'blocked-not-active');
});

test('source-family cardiovascular/autonomic/local-O2 chain advances and conserves blood volume',()=>{
  c.runFor(10);
  baseline=c.snapshot();
  for(const v of Object.values(baseline.physicianState)){
    if(typeof v==='number') assert(Number.isFinite(v));
  }
  assert(baseline.cardiovascular.controller);
  assert(baseline.cardiovascular.localO2);
  assert(
    Math.abs(baseline.cardiovascular.conservation.errorMl)<1e-6,
    'blood-volume closure error='+baseline.cardiovascular.conservation.errorMl
  );
});

test('PaO2 PaCO2 and Vent-delivered VT enter the same persistent candidate patient',()=>{
  const before=baseline.cardiovascular.controller.autonomic;
  c.setCanonicalInputs({
    pao2MmHg:50,
    paco2MmHg:60,
    deliveredTidalVolumeL:0.4,
  });
  c.runFor(10);
  challenged=c.snapshot();
  assert.equal(challenged.timeSec,20.00000000000146);
  assert.equal(challenged.inputs.pao2MmHg,50);
  assert.equal(challenged.inputs.paco2MmHg,60);
  assert.equal(challenged.inputs.deliveredTidalVolumeL,0.4);
  const after=challenged.cardiovascular.controller.autonomic;
  assert(
    Math.abs(after.fShSpikesPerSec-before.fShSpikesPerSec)>1e-6 ||
    Math.abs(after.fSpSpikesPerSec-before.fSpSpikesPerSec)>1e-6 ||
    Math.abs(after.fVSpikesPerSec-before.fVSpikesPerSec)>1e-6,
    'gas/VT challenge must reach autonomic controller'
  );
});

test('unresolved Vent-to-Karamolegkos coordinate bridge fails closed',()=>{
  assert.throws(
    ()=>c.setCanonicalInputs({absoluteAlveolarVolumeL:3}),
    /blocked until the Vent-to-Karamolegkos coordinate bridge/
  );
  assert.throws(
    ()=>c.setCanonicalInputs({pleuralPressureMmHg:-5}),
    /blocked until the Vent-to-Karamolegkos coordinate bridge/
  );
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
