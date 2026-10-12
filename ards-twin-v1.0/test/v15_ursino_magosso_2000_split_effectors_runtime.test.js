'use strict';

const assert=require('node:assert/strict');
const {
  sourceTargets,
}=require('../src/ursino_magosso_2000_split_effectors_candidate.js');
const {
  createUrsinoMagosso2000SplitEffectorsRuntime,
}=require('../src/ursino_magosso_2000_split_effectors_runtime.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}
function close(a,b,tol=1e-12){
  return Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b));
}

test('runtime initializes exactly at source static targets',()=>{
  const vascular=6,cardiac=7,vagal=4;
  const expected=sourceTargets({
    vascularSympatheticSpikesPerSec:vascular,
    cardiacSympatheticSpikesPerSec:cardiac,
    cardiacVagalSpikesPerSec:vagal,
  }).absolute;
  const r=createUrsinoMagosso2000SplitEffectorsRuntime({
    initialVascularSympatheticSpikesPerSec:vascular,
    initialCardiacSympatheticSpikesPerSec:cardiac,
    initialCardiacVagalSpikesPerSec:vagal,
  });
  const s=r.snapshot();
  for(const k of Object.keys(expected)) assert(close(s.absolute[k],expected[k]),k);
  assert.equal(s.authority,'candidate-not-canonical');
  assert.equal(s.canonicalControlAuthority,false);
});

test('vascular sympathetic change does not directly alter cardiac target channels before delay',()=>{
  const r=createUrsinoMagosso2000SplitEffectorsRuntime({
    initialVascularSympatheticSpikesPerSec:6,
    initialCardiacSympatheticSpikesPerSec:6,
    initialCardiacVagalSpikesPerSec:4,
  });
  const before=r.snapshot().absolute;
  for(let i=0;i<10;i++) r.step({
    dtSec:0.1,
    vascularSympatheticSpikesPerSec:12,
    cardiacSympatheticSpikesPerSec:6,
    cardiacVagalSpikesPerSec:4,
  });
  const after=r.snapshot().absolute;
  assert(close(after.EmaxLv,before.EmaxLv));
  assert(close(after.heartPeriodSec,before.heartPeriodSec));
});

test('source pure delays retain the basal prehistory after a step input',()=>{
  const r=createUrsinoMagosso2000SplitEffectorsRuntime({
    initialVascularSympatheticSpikesPerSec:6,
    initialCardiacSympatheticSpikesPerSec:6,
    initialCardiacVagalSpikesPerSec:4,
  });
  const before=r.snapshot().absolute;

  // Resistance delay is 2 s; venous unstressed-volume delay is 5 s.
  for(let i=0;i<20;i++) r.step({
    dtSec:0.1,
    vascularSympatheticSpikesPerSec:12,
    cardiacSympatheticSpikesPerSec:6,
    cardiacVagalSpikesPerSec:4,
  });
  const at2s=r.snapshot().absolute;
  assert(close(at2s.Rsp,before.Rsp));
  assert(close(at2s.Rep,before.Rep));
  assert(close(at2s.Vusv,before.Vusv));

  r.step({
    dtSec:0.1,
    vascularSympatheticSpikesPerSec:12,
    cardiacSympatheticSpikesPerSec:6,
    cardiacVagalSpikesPerSec:4,
  });
  const after2s=r.snapshot().absolute;
  assert(after2s.Rsp>before.Rsp);
  assert(after2s.Rep>before.Rep);
  assert(close(after2s.Vusv,before.Vusv));

  // Step beyond the exact floating-point boundary so this tests the source
  // latency rather than binary representation of 5.0 s.
  for(let i=0;i<31;i++) r.step({
    dtSec:0.1,
    vascularSympatheticSpikesPerSec:12,
    cardiacSympatheticSpikesPerSec:6,
    cardiacVagalSpikesPerSec:4,
  });
  const after5s=r.snapshot().absolute;
  assert(after5s.Vusv<before.Vusv);
  assert(after5s.Vuev<before.Vuev);
  assert(after5s.Vumv<before.Vumv);
});

test('after source delays vascular sympathetic activation raises R and lowers venous unstressed volumes',()=>{
  const r=createUrsinoMagosso2000SplitEffectorsRuntime({
    initialVascularSympatheticSpikesPerSec:6,
    initialCardiacSympatheticSpikesPerSec:6,
    initialCardiacVagalSpikesPerSec:4,
  });
  const before=r.snapshot().absolute;
  for(let i=0;i<100;i++) r.step({
    dtSec:0.1,
    vascularSympatheticSpikesPerSec:12,
    cardiacSympatheticSpikesPerSec:6,
    cardiacVagalSpikesPerSec:4,
  });
  const after=r.snapshot().absolute;
  assert(after.Rsp>before.Rsp);
  assert(after.Rep>before.Rep);
  assert(after.RmpNormal>before.RmpNormal);
  assert(after.Vusv<before.Vusv);
  assert(after.Vuev<before.Vuev);
  assert(after.Vumv<before.Vumv);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
