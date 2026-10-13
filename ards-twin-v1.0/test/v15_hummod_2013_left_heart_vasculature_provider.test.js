'use strict';

const assert=require('node:assert/strict');
const {
  TAU_DAYS,
  K_PER_MIN,
  PO2_ON_STIMULUS,
  hermite,
  createHumMod2013LeftHeartVasculature,
}=require('../src/hummod_2013_left_heart_vasculature_provider.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}
function near(a,b,tol=1e-12){
  assert(Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b)),
    a+' not near '+b);
}

test('source tau and PO2 stimulus curve are preserved',()=>{
  near(TAU_DAYS,30);
  near(K_PER_MIN,1/(30*1440));
  near(hermite(PO2_ON_STIMULUS,41),1.2);
  near(hermite(PO2_ON_STIMULUS,51),1.0);
  near(hermite(PO2_ON_STIMULUS,61),0.8);
});

test('initial source state is effect 1',()=>{
  const v=createHumMod2013LeftHeartVasculature();
  const s=v.snapshot();
  near(s.effect,1);
  assert.equal(s.controlAuthority,false);
});

test('chronic low myocardial PO2 slowly increases vascular effect',()=>{
  const v=createHumMod2013LeftHeartVasculature();
  let s=v.snapshot();
  for(let i=0;i<30;i++){
    s=v.step({
      dtSec:24*60*60,
      myocardialPo2MmHg:41,
      leftHeartFunctionFailed:false,
    });
  }
  assert(s.effect>1);
  assert(s.effect<1.2);
});

test('high myocardial PO2 slowly lowers vascular effect',()=>{
  const v=createHumMod2013LeftHeartVasculature();
  let s=v.snapshot();
  for(let i=0;i<30;i++){
    s=v.step({
      dtSec:24*60*60,
      myocardialPo2MmHg:61,
      leftHeartFunctionFailed:false,
    });
  }
  assert(s.effect<1);
  assert(s.effect>0.8);
});

test('heart-function failure sets source stimulus to zero',()=>{
  const v=createHumMod2013LeftHeartVasculature();
  const s=v.step({
    dtSec:60,
    myocardialPo2MmHg:51,
    leftHeartFunctionFailed:true,
  });
  near(s.stimulus,0);
  assert(s.effect<1);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
