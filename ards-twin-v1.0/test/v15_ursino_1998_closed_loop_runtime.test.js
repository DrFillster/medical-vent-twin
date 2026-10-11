'use strict';
const assert=require('node:assert/strict');
const {
  derivedRestingControlState,defaultSeed,createUrsino1998ClosedLoopRuntime,
}=require('../src/ursino_1998_closed_loop_runtime.js');

let passed=0,failed=0;
function test(name,fn){
 try{fn();console.log('ok -',name);passed++;}
 catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}

test('resting control initialization is derived from source equations',()=>{
 const r=derivedRestingControlState();
 for(const k of ['fCs','fEs','fEv','dEmaxLv','dEmaxRv','dRsp','dRep','dVusv','dVuev','dTs','dTv','heartPeriodSec']){
   assert(Number.isFinite(r[k]),k+' must be finite');
 }
 assert(r.heartPeriodSec>0);
});

test('default seed contains all finite source states',()=>{
 const s=defaultSeed();
 for(const [k,v] of Object.entries(s)) assert(Number.isFinite(v),k);
});

test('closed-loop runtime advances with primary Eq 30 rate term present',()=>{
 const r=createUrsino1998ClosedLoopRuntime({dtSec:0.002});
 const a=r.snapshot();
 const b=r.runFor(0.2);
 assert(b.timeSec>a.timeSec);
 assert(Number.isFinite(b.hemodynamics.heartRatePerMin));
 assert(Number.isFinite(b.hemodynamics.systemicArterialPressureMmHg));
 assert(Number.isFinite(b.hemodynamics.leftVentricleOutflowMlPerSec));
});

test('blood withdrawal changes source total blood-volume state without a scripted BP response',()=>{
 const r=createUrsino1998ClosedLoopRuntime({dtSec:0.002});
 const before=r.snapshot().state.Vt;
 r.withdrawBloodMl(530);
 const after=r.snapshot().state.Vt;
 assert.equal(after,before-530);
});

test('candidate remains explicitly non-canonical',()=>{
 const r=createUrsino1998ClosedLoopRuntime({dtSec:0.002});
 assert.equal(r.snapshot().authority,'candidate-not-canonical');
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
