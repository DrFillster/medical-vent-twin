'use strict';

const assert=require('node:assert/strict');
const {
  createHumMod2013BaroChemoreflexSaNodeCandidate,
}=require('../src/hummod_2013_baro_chemoreflex_sa_node_candidate.js');

function runFor(controller,seconds,input){
  const dtSec=0.1;
  for(let i=0;i<Math.round(seconds/dtSec);i++){
    controller.step({dtSec,...input});
  }
  return controller.snapshot();
}

const c=createHumMod2013BaroChemoreflexSaNodeCandidate({
  ecfvMl:15000,
  initialArterialPh:7.44,
  initialCarotidSinusPressureMmHg:87,
});

runFor(c,60,{
  arterialPo2MmHg:90,
  arterialPh:7.40,
  carotidSinusPressureMmHg:82,
});

const challenge={
  arterialPo2MmHg:35,
  arterialPh:6.90,
  carotidSinusPressureMmHg:104,
};

const s30=runFor(c,30,challenge);
const s60=runFor(c,30,challenge);
const s120=runFor(c,60,challenge);
const s300=runFor(c,180,challenge);
const s600=runFor(c,300,challenge);

assert(s60.heartRatePerMin>s30.heartRatePerMin,'HR should increase as chemoreflex/sympathoadrenal drive develops');
assert(s120.heartRatePerMin>s60.heartRatePerMin,'HR should continue to rise by 120 s');
assert(s300.heartRatePerMin>s120.heartRatePerMin,'HR should be tachycardic by 300 s');
assert(s600.heartRatePerMin>s300.heartRatePerMin,'HR should continue toward the preserved severe-challenge plateau');

function near(a,b,tol=1e-9){
  assert(Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b)), a+' not near '+b);
}

// Regression against the preserved v2.4 diagnostic at commit
// 2ba30d7e4851adc1232829a33976ea641ac218e6.
// These values verify an exact port; they are not clinical target fitting.
near(s30.heartRatePerMin,64.75263382910528);
near(s60.heartRatePerMin,71.87071513926804);
near(s120.heartRatePerMin,84.31248775188277);
near(s300.heartRatePerMin,126.50974881849558);
near(s600.heartRatePerMin,168.21522587507803);

console.log(JSON.stringify({
  s30:s30.heartRatePerMin,
  s60:s60.heartRatePerMin,
  s120:s120.heartRatePerMin,
  s300:s300.heartRatePerMin,
  s600:s600.heartRatePerMin,
},null,2));
console.log('ok - HumMod 2012/2013 tachycardia regression');
