'use strict';
const assert=require('node:assert/strict');
const m=require('../src/ursino_1998_closed_loop_candidate.js');

let passed=0,failed=0;
function test(name,fn){
 try{fn();console.log('ok -',name);passed++;}
 catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}
function close(a,b,tol=1e-10){return Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b));}

test('primary source and Tables 1-3 are pinned',()=>{
 assert.equal(m.SOURCE.doi,'10.1152/ajpheart.1998.275.5.H1733');
 assert.equal(m.VASCULAR.totalBloodVolumeMl,5300);
 assert.equal(m.VASCULAR.sp.R,3.307);
 assert.equal(m.HEART.lv.EmaxPhysicalBasal,2.95);
 assert.equal(m.CONTROL.afferent.PnMmHg,92);
 assert.equal(m.CONTROL.afferent.tauZSec,6.37);
 assert.equal(m.CONTROL.effectors.T0Sec,0.58);
});

test('Eq 31 central pressure gives midpoint afferent firing',()=>{
 const f=m.baroreceptorStatic(92);
 assert(close(f,(2.52+47.78)/2));
});

test('Eq 33 sympathetic activity falls as baroreceptor firing rises',()=>{
 assert(m.sympatheticEfferent(10)>m.sympatheticEfferent(30));
});

test('Eq 34 vagal activity rises as baroreceptor firing rises',()=>{
 assert(m.vagalEfferent(30)>m.vagalEfferent(10));
});

test('Eqs 35 and 38 preserve effector signs',()=>{
 const fes=10;
 assert(m.sympatheticEffectorStatic(fes,m.CONTROL.effectors.EmaxLv)>0);
 assert(m.sympatheticEffectorStatic(fes,m.CONTROL.effectors.Rsp)>0);
 assert(m.sympatheticEffectorStatic(fes,m.CONTROL.effectors.Vusv)<0);
 assert(m.sympatheticEffectorStatic(fes,m.CONTROL.effectors.Ts)<0);
});

test('Eq 42 source-denervated period uses T0 exactly',()=>{
 assert.equal(m.heartPeriodSec(0,0),0.58);
});

test('Eq 22 reproduces source systolic-duration relation',()=>{
 const T=0.833;
 assert(close(m.systolicDurationSec(T),0.5-0.075/T));
});

test('Eq 19 activation is bounded',()=>{
 for(let u=0;u<=1;u+=0.01){
   const phi=m.ventricularActivation({phaseFraction:u,Tsec:0.833});
   assert(phi>=0&&phi<=1+1e-12);
 }
});

test('Eqs 15-17 ideal aortic valve blocks reverse LV outflow',()=>{
 const s=m.ventricularFlows({
   side:'lv',atrialPressureMmHg:5,arterialPressureMmHg:200,
   volumeMl:100,phaseFraction:0,Tsec:0.833,EmaxMmHgPerMl:2.95,
 });
 assert.equal(s.outflowMlPerSec,0);
});

test('Eq 9 blood-volume closure is finite at a source-like state',()=>{
 const psv=m.splanchnicVenousPressureMmHg({
   totalBloodVolumeMl:5300,Psa:100,Psp:90,Pev:10,Pra:2,Vrv:60,
   Ppa:15,Ppp:10,Ppv:7,Pla:5,Vlv:120,
   VusvMl:1121,VuevMl:1375,
 });
 assert(Number.isFinite(psv));
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
