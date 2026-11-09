'use strict';

const assert=require('node:assert/strict');
const {createHennigsNeuralOscillatorRuntime}=require('../src/hennigs_neural_oscillator_runtime.js');
const {createHennigsPhysicalClockAdapter}=require('../src/hennigs_physical_clock_adapter.js');

function estimateRawPeriodSec(dRel){
  const dtSec=0.002;
  const r=createHennigsNeuralOscillatorRuntime({dtSec,dRel});
  let previous=r.snapshot().state.I;
  const crossings=[];
  for(let i=0;i<300000 && crossings.length<10;i++){
    const s=r.step();
    if(s.timeSec>120 && previous<=0 && s.state.I>0) crossings.push(s.timeSec);
    previous=s.state.I;
  }
  if(crossings.length<4) throw new Error('insufficient oscillator cycles at dRel='+dRel);
  const periods=crossings.slice(1).map((t,i)=>t-crossings[i]);
  return periods.reduce((a,b)=>a+b,0)/periods.length;
}

const clock=createHennigsPhysicalClockAdapter({estimateRawPeriodSec});
for(const dRel of [0.25,0.5,0.75]){
  const m=clock.mapping(dRel);
  const mappedRr=60/(m.rawPeriodSec/m.rawTimePerPhysicalSecond);
  assert.ok(Math.abs(mappedRr-m.targetRrPerMin)<1e-9);
  assert.equal(m.controlAuthority,false);
  console.log(JSON.stringify({dRel,rawPeriodSec:m.rawPeriodSec,targetRr:m.targetRrPerMin,scale:m.rawTimePerPhysicalSecond,mappedRr}));
}
console.log('ok - non-dimensional Hennigs oscillator maps exactly to Eq.9 physical RR');
