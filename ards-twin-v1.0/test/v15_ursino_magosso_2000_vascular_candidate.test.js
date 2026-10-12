'use strict';

const assert=require('node:assert/strict');
const {
  VASCULAR_2000:V,
}=require('../src/ursino_magosso_2000_hypoxia_plant_parameters.js');
const {
  totalUnstressedVolumeMl,
  extrasplanchnicVenousPressureMmHg,
  vascularDerivatives,
}=require('../src/ursino_magosso_2000_vascular_candidate.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}

test('Eq13 total unstressed volume includes every source compartment',()=>{
  const vu=totalUnstressedVolumeMl();
  assert(Number.isFinite(vu));
  assert(vu>0);
});

test('Eq12 blood-volume closure returns a finite algebraic Pev',()=>{
  const Pev=extrasplanchnicVenousPressureMmHg({
    Psa:100,Psp:90,Psv:8,Pmv:8,Pbv:8,Phv:8,
    Pra:4,Vrv:100,Ppa:18,Ppp:12,Ppv:8,Pla:8,Vlv:120,
  });
  assert(Number.isFinite(Pev));
});

test('Eqs1-11 source derivatives and five regional flows are finite',()=>{
  const out=vascularDerivatives({
    state:{
      Ppa:18,Fpa:85,Ppp:12,Ppv:8,
      Psa:100,Fsa:85,Psp:90,
      Psv:8,Pmv:8,Pbv:8,Phv:8,
      Pra:4,Vrv:100,Pla:8,Vlv:120,Vt:5300,
    },
    leftVentricleOutflowMlPerSec:85,
    rightVentricleOutflowMlPerSec:85,
  });
  for(const v of Object.values(out.derivative)){
    assert(Number.isFinite(v));
  }
  assert.equal(Object.keys(out.flows).length,10);
  for(const v of Object.values(out.flows)){
    assert(Number.isFinite(v));
  }
  assert.equal(out.authority,'candidate-not-canonical');
});

test('Eq8 and Eq9 carry only source-regulated venous unstressed-volume rates',()=>{
  const state={
    Ppa:18,Fpa:85,Ppp:12,Ppv:8,
    Psa:100,Fsa:85,Psp:90,
    Psv:8,Pmv:8,Pbv:8,Phv:8,
    Pra:4,Vrv:100,Pla:8,Vlv:120,Vt:5300,
  };
  const a=vascularDerivatives({
    state,
    leftVentricleOutflowMlPerSec:85,
    rightVentricleOutflowMlPerSec:85,
  });
  const b=vascularDerivatives({
    state,
    leftVentricleOutflowMlPerSec:85,
    rightVentricleOutflowMlPerSec:85,
    venousUnstressedVolumeRates:{sv:-10,mv:-5},
  });
  assert(b.derivative.Psv>a.derivative.Psv);
  assert(b.derivative.Pmv>a.derivative.Pmv);
  assert.equal(b.derivative.Pbv,a.derivative.Pbv);
  assert.equal(b.derivative.Phv,a.derivative.Phv);
});

test('2000 source uses algebraic Pev rather than a Pev differential state',()=>{
  const out=vascularDerivatives({
    state:{
      Ppa:18,Fpa:85,Ppp:12,Ppv:8,
      Psa:100,Fsa:85,Psp:90,
      Psv:8,Pmv:8,Pbv:8,Phv:8,
      Pra:4,Vrv:100,Pla:8,Vlv:120,Vt:5300,
    },
    leftVentricleOutflowMlPerSec:85,
    rightVentricleOutflowMlPerSec:85,
  });
  assert(!Object.prototype.hasOwnProperty.call(out.derivative,'Pev'));
  assert(Number.isFinite(out.PevMmHg));
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
