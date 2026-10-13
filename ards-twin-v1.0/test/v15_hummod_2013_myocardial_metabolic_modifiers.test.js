'use strict';

const assert=require('node:assert/strict');
const {
  THYROID_EFFECT,
  HEAT_CORE,
  hermite,
  thyroidEffectFromPool2013,
  heatMetabolismCoreFromTemp2013,
}=require('../src/hummod_2013_myocardial_metabolic_modifiers.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}
function near(a,b,tol=1e-12){
  assert(Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b)),
    a+' not near '+b);
}

test('thyroid source curve identity is preserved',()=>{
  near(hermite(THYROID_EFFECT,0),0.7);
  near(hermite(THYROID_EFFECT,8),1.0);
  near(hermite(THYROID_EFFECT,40),1.5);
  near(thyroidEffectFromPool2013({totalT4T3:8}).thyroidEffect,1);
});

test('heat-metabolism core source curve identity is preserved',()=>{
  near(hermite(HEAT_CORE,10),0);
  near(hermite(HEAT_CORE,37),1);
  near(hermite(HEAT_CORE,40),1.5);
  near(hermite(HEAT_CORE,46),0);
  near(heatMetabolismCoreFromTemp2013({coreTempC:37}).heatMetabolismCore,1);
});

test('metabolic modifiers remain observational',()=>{
  assert.equal(
    thyroidEffectFromPool2013({totalT4T3:8}).controlAuthority,
    false
  );
  assert.equal(
    heatMetabolismCoreFromTemp2013({coreTempC:37}).controlAuthority,
    false
  );
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
