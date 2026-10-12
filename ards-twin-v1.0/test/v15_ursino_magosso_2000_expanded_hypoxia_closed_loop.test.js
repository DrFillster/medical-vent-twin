'use strict';

const assert=require('node:assert/strict');
const {
  createUrsinoMagosso2000ExpandedHypoxiaClosedLoop,
}=require('../src/ursino_magosso_2000_expanded_hypoxia_closed_loop.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}
function mean(r,seconds){
  const dt=0.002,n=Math.round(seconds/dt);
  const x={hr:0,map:0,co:0,vt:0,rbrain:0,rheart:0,rmuscle:0};
  for(let i=0;i<n;i++){
    const s=r.snapshot();
    x.hr+=s.hemodynamics.heartRatePerMin;
    x.map+=s.hemodynamics.systemicArterialPressureMmHg;
    x.co+=s.hemodynamics.leftVentricleOutflowMlPerSec;
    x.vt+=s.ventilation.activeTidalVolumeL;
    x.rbrain+=s.vascularEffectors.Rbp;
    x.rheart+=s.vascularEffectors.Rhp;
    x.rmuscle+=s.vascularEffectors.Rmp;
    r.step();
  }
  for(const k of Object.keys(x)) x[k]/=n;
  return x;
}

test('expanded hypoxia loop remains candidate-only with exact blood-volume closure',()=>{
  const r=createUrsinoMagosso2000ExpandedHypoxiaClosedLoop({dtSec:0.002});
  const s=r.runFor(1);
  assert.equal(s.authority,'candidate-not-canonical');
  assert.equal(s.canonicalControlAuthority,false);
  assert.equal(s.candidatePlantControlAuthority,true);
  assert(Math.abs(s.conservation.errorMl)<1e-5);
});

test('deep isocapnic hypoxia produces source local vasodilation in brain heart and muscle',()=>{
  const r=createUrsinoMagosso2000ExpandedHypoxiaClosedLoop({
    dtSec:0.002,
    ventilationMode:'ursino-magosso-2000-spontaneous-validation',
  });
  r.runFor(120);
  const base=mean(r,5);
  r.setEnvironment({pao2MmHg:28,paco2MmHg:40});
  r.runFor(40);
  const low=mean(r,5);
  assert(low.rbrain<base.rbrain);
  assert(low.rheart<base.rheart);
  assert(low.rmuscle<base.rmuscle);
  assert(low.vt>base.vt);
});

test('deep hypoxia has biphasic HR response in expanded source plant',()=>{
  const r=createUrsinoMagosso2000ExpandedHypoxiaClosedLoop({
    dtSec:0.002,
    ventilationMode:'ursino-magosso-2000-spontaneous-validation',
  });
  r.runFor(120);
  const base=mean(r,5);
  r.setEnvironment({pao2MmHg:28,paco2MmHg:40});
  const early=mean(r,5);
  const transition=mean(r,15);
  const late=mean(r,20);
  assert(early.hr<base.hr,'source early hypoxia should lower HR');
  assert(late.hr>early.hr,'late source pathways should reverse early HR fall');
  assert(Number.isFinite(transition.map));
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
