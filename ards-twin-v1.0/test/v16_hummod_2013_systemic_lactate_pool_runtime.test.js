'use strict';

const assert=require('node:assert/strict');
const {
  createHumMod2013SystemicLactatePoolRuntime,
}=require('../src/hummod_2013_systemic_lactate_pool_runtime.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}

function zeroOutflows(){
  return Object.freeze({
    bone:0,
    brain:0,
    fat:0,
    giTract:0,
    rightKidney:0,
    leftKidney:0,
    leftHeart:0,
    liver:0,
    otherTissue:0,
    respiratoryMuscle:0,
    rightHeart:0,
    skeletalMuscle:0,
    skin:0,
  });
}

test('systemic lactate pool initializes from source 1 mEq/L state',()=>{
  const r=createHumMod2013SystemicLactatePoolRuntime({initialEcfvMl:15000});
  const s=r.snapshot({ecfvMl:15000});
  assert(Math.abs(s.concentrationMeqPerL-1)<1e-12);
  assert.equal(s.canonicalControlAuthority,false);
});

test('zero source rates preserve pool mass',()=>{
  const r=createHumMod2013SystemicLactatePoolRuntime({initialEcfvMl:15000});
  const before=r.snapshot({ecfvMl:15000});
  const after=r.step({
    dtSec:60,
    ecfvMl:15000,
    tissueOutflowsMeqPerMin:zeroOutflows(),
    ivDripLactateRateMeqPerMin:0,
    pumpRateMeqPerMin:0,
  });
  assert(Math.abs(after.massMeq-before.massMeq)<1e-12);
});

test('positive tissue outflow raises systemic lactate mass',()=>{
  const r=createHumMod2013SystemicLactatePoolRuntime({initialEcfvMl:15000});
  const before=r.snapshot({ecfvMl:15000});
  const outflows={...zeroOutflows(),leftHeart:0.1};
  const after=r.step({
    dtSec:60,
    ecfvMl:15000,
    tissueOutflowsMeqPerMin:outflows,
    ivDripLactateRateMeqPerMin:0,
    pumpRateMeqPerMin:0,
  });
  assert(after.massMeq>before.massMeq);
  assert(after.concentrationMeqPerL>before.concentrationMeqPerL);
});

test('runtime fails closed when any source organ outflow is missing',()=>{
  const r=createHumMod2013SystemicLactatePoolRuntime({initialEcfvMl:15000});
  const outflows={...zeroOutflows()};
  delete outflows.skin;
  assert.throws(()=>r.step({
    dtSec:1,
    ecfvMl:15000,
    tissueOutflowsMeqPerMin:outflows,
    ivDripLactateRateMeqPerMin:0,
    pumpRateMeqPerMin:0,
  }),/missing source lactate outflows/);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
