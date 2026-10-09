'use strict';

const {
  MUSCLE_PUMP_CURVE,
  exerciseMusclePumpEffect,
}=require('../src/hummod_exercise_muscle_pump_source_aligned.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}
function assert(v,m){if(!v)throw new Error(m||'assertion failed');}
function near(a,b,tol=1e-9){if(Math.abs(a-b)>tol)throw new Error(a+' not near '+b);}

test('preserves HumMod Exercise-MusclePump curve knots',()=>{
  assert(MUSCLE_PUMP_CURVE.length===2);
  near(exerciseMusclePumpEffect(0).effect,1);
  near(exerciseMusclePumpEffect(1600).effect,5);
});

test('100 W bicycle metabolic target increases native venous conductance multiplier',()=>{
  const totalWatts=100/0.30;
  const s=exerciseMusclePumpEffect(totalWatts);
  assert(s.effect>1,'exercise muscle pump should increase venous conductance');
  assert(s.effect<5,'100 W bicycle target should remain below max curve effect');
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
