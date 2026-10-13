'use strict';

const assert=require('node:assert/strict');
const {
  REQUIRED_SUBSYSTEMS,
  readiness,
}=require('../src/hummod_2013_adh_provider_contract.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}

test('ADH provider remains explicitly fail-closed',()=>{
  const r=readiness();
  assert.equal(r.readyForLiveADHLog10Conc,false);
  assert.equal(r.fixedNormalSubstitutionAllowed,false);
  assert.equal(r.authority,'diagnostic-only');
});

test('ADH contract captures endocrine osmoregulatory and clearance dependencies',()=>{
  const joined=REQUIRED_SUBSYSTEMS.join(' ');
  assert.match(joined,/OsmBody/);
  assert.match(joined,/Nucleus-ADH/);
  assert.match(joined,/Cortisol/);
  assert.match(joined,/kidney plasma flow/);
  assert.match(joined,/GFR/);
  assert.match(joined,/other-tissue blood flow/);
  assert.match(joined,/ECFV/);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
