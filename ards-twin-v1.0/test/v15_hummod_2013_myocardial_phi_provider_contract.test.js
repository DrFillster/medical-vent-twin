'use strict';

const assert=require('node:assert/strict');
const {
  STATUS,
  readiness,
}=require('../src/hummod_2013_myocardial_phi_provider_contract.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}

test('myocardial pHi readiness remains fail-closed for live replacement',()=>{
  const r=readiness();
  assert.equal(r.authority,'diagnostic-only');
  assert.equal(r.summary.readyToReplaceExplicitMyocardialPHiInLiveModel,false);
  assert.equal(r.summary.fixedInitialStateSubstitutionAllowed,false);
  assert.equal(r.summary.olderGenerationFuelOrPotassiumSubstitutionAllowed,false);
});

test('direct pHi blockers are current LV water KCell and systemic lactate pool',()=>{
  const r=readiness();
  assert(r.summary.blockedFields.includes('liquidVolumeMl'));
  assert(r.summary.blockedFields.includes('intracellularPotassium'));
  assert(r.summary.blockedFields.includes('lactatePoolConcentration'));
});

test('2013 anaerobic myocardial glucose behavior is marked equation-closed',()=>{
  const r=readiness();
  const byField=Object.fromEntries(r.fields.map(x=>[x.field,x]));
  assert.equal(
    byField.anaerobicGlucoseUsedMgPerMin.status,
    STATUS.EQUATION_CLOSED
  );
  assert.match(
    byField.anaerobicGlucoseUsedMgPerMin.note,
    /=0|= 0|sets Anaerobic/i
  );
});

test('blood SID and arterial bicarbonate remain runtime boundary dependent',()=>{
  const r=readiness();
  const byField=Object.fromEntries(r.fields.map(x=>[x.field,x]));
  assert.equal(byField.bloodSid.status,STATUS.RUNTIME_BOUNDARY_DEPENDENT);
  assert.equal(byField.arterialHco3.status,STATUS.RUNTIME_BOUNDARY_DEPENDENT);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
