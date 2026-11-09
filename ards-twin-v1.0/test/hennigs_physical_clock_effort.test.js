'use strict';

const assert=require('node:assert/strict');
const {createHennigsNeuralOscillatorRuntime}=require('../src/hennigs_neural_oscillator_runtime.js');
const {createHennigsPatientEffortCandidate}=require('../src/hennigs_patient_effort_candidate.js');

function estimateRawPeriodSec(dRel){
  const dtSec=0.002;
  const r=createHennigsNeuralOscillatorRuntime({dtSec,dRel});
  let prev=r.snapshot().state.I;
  const x=[];
  for(let i=0;i<300000&&x.length<10;i++){
    const s=r.step();
    if(s.timeSec>120&&prev<=0&&s.state.I>0)x.push(s.timeSec);
    prev=s.state.I;
  }
  const p=x.slice(1).map((t,i)=>t-x[i]);
  return p.reduce((a,b)=>a+b,0)/p.length;
}

for(const dRel of [0.25,0.5,0.75]){
  const dtSec=0.002;
  const e=createHennigsPatientEffortCandidate({
    dtSec,dRel,gainProfile:'hennigs-2026-validation-reference',
    physicalClock:{profile:'hennigs-eq9',estimateRawPeriodSec},
  });
  let prevI=e.oscillator.snapshot().state.I;
  const crossings=[];
  const steps=Math.round(120/dtSec);
  for(let i=0;i<steps;i++){
    const s=e.step();
    if(s.timeSec>30&&prevI<=0&&s.inspiratoryActivity>0)crossings.push(s.timeSec);
    prevI=s.inspiratoryActivity;
  }
  const periods=crossings.slice(1).map((t,i)=>t-crossings[i]);
  const mean=periods.reduce((a,b)=>a+b,0)/periods.length;
  const empirical=60/mean;
  const target=e.snapshot().prescribedRespiratoryRatePerMin;
  assert.ok(Math.abs(empirical-target)<0.15,JSON.stringify({dRel,empirical,target}));
  console.log(JSON.stringify({dRel,empiricalRr:empirical,targetRr:target,cycles:crossings.length}));
}
console.log('ok - Eq.9 physical clock propagates through Hennigs patient-effort output');
