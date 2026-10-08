'use strict';
const {
  CURVES,
  FAILURE_EFFECT_THRESHOLD,
  RECOVERY_EFFECT_THRESHOLD,
  hermite,
  calculateSide,
  createHumModSourceAlignedHeartFunction,
}=require('../src/hummod_ards_heart_function_source_aligned.js');
let passed=0,failed=0;
function test(name,fn){try{fn();console.log('ok -',name);passed++;}catch(e){console.error('FAIL -',name,':',e.message);failed++;}}
function assert(v,m){if(!v)throw new Error(m||'assertion failed');}
function near(a,b,tol=1e-9){assert(Math.abs(a-b)<=tol,a+' not near '+b);}

test('HumMod myocardial pH curve knots are preserved',()=>{
  near(hermite(CURVES.ph,6.6),0);
  near(hermite(CURVES.ph,6.7),1);
});

test('normal local myocardial state has near-unit function',()=>{
  const s=calculateSide({myocardialPh:7.05});
  near(s.phEffect,1);
  near(s.proteinEffect,1);
  near(s.fuelEffect,1);
  near(s.temperatureEffect,1);
  near(s.effect,1);
});

test('run06-like severe local myocardial acidosis crosses native failure threshold',()=>{
  const left=calculateSide({myocardialPh:6.61});
  const right=calculateSide({myocardialPh:6.43});
  assert(left.effect<FAILURE_EFFECT_THRESHOLD,'left-heart function should fail near run06 terminal local pH');
  assert(right.effect<FAILURE_EFFECT_THRESHOLD,'right-heart function should fail near run06 terminal local pH');
});

test('left-heart failure drives HumMod asystole state',()=>{
  const h=createHumModSourceAlignedHeartFunction();
  let s=h.step({left:{myocardialPh:7.05},right:{myocardialPh:7.05}});
  assert(s.isAsystole===false);
  s=h.step({left:{myocardialPh:6.61},right:{myocardialPh:6.43}});
  assert(s.left.failed===true);
  assert(s.right.failed===true);
  assert(s.isAsystole===true);
});

test('failure latch does not clear until function exceeds native recovery threshold',()=>{
  const h=createHumModSourceAlignedHeartFunction();
  h.step({left:{myocardialPh:6.60},right:{myocardialPh:7.05}});
  let s=h.step({left:{myocardialPh:6.63},right:{myocardialPh:7.05}});
  assert(s.left.effect>FAILURE_EFFECT_THRESHOLD,'intermediate effect should exceed failure threshold');
  assert(s.left.effect<RECOVERY_EFFECT_THRESHOLD,'intermediate effect should remain below recovery threshold');
  assert(s.left.failed===true,'failure must remain latched');
  s=h.step({left:{myocardialPh:6.66},right:{myocardialPh:7.05}});
  assert(s.left.effect>RECOVERY_EFFECT_THRESHOLD,'recovery effect should exceed threshold');
  assert(s.left.failed===false,'failure should clear after native recovery threshold');
});

test('module explicitly forbids arterial-pH substitution',()=>{
  const h=createHumModSourceAlignedHeartFunction();
  assert(h.snapshot().provenance.arterialPhSubstitutionAllowed===false);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
