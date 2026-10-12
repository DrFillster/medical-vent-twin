#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {
  createHennigsNeuralOscillatorRuntime,
}=require('../src/hennigs_neural_oscillator_runtime.js');

function runCase({dRel,dtSec=0.001,settleSec=120,observeSec=120}){
  const r=createHennigsNeuralOscillatorRuntime({dtSec,dRel});
  r.runFor(settleSec);

  let prev2=null;
  let prev1=null;
  const peaks=[];
  const startSec=r.snapshot().timeSec;
  const n=Math.round(observeSec/dtSec);

  for(let i=0;i<n;i++){
    const s=r.step();
    const point={t:s.timeSec,i:s.state.I};
    if(prev2&&prev1){
      if(prev1.i>prev2.i&&prev1.i>=point.i){
        peaks.push(prev1);
      }
    }
    prev2=prev1;
    prev1=point;
  }

  // Suppress numerical duplicate maxima by requiring a physiologically
  // impossible-to-confuse minimum interval of 0.25 s. This is only event
  // de-duplication; it is not used to set the respiratory rate.
  const accepted=[];
  for(const p of peaks){
    if(!accepted.length||p.t-accepted[accepted.length-1].t>=0.25){
      accepted.push(p);
    }else if(p.i>accepted[accepted.length-1].i){
      accepted[accepted.length-1]=p;
    }
  }

  if(accepted.length<3){
    return {
      dRel,dtSec,settleSec,observeSec,
      prescribedRespiratoryRatePerMin:r.snapshot().prescribedRespiratoryRatePerMin,
      detectedPeaks:accepted.length,
      measuredRespiratoryRatePerMin:null,
      relativeError:null,
      status:'NO_STABLE_OSCILLATION_DETECTED',
      finalState:r.snapshot().state,
    };
  }

  const intervals=[];
  for(let i=1;i<accepted.length;i++){
    intervals.push(accepted[i].t-accepted[i-1].t);
  }
  const meanPeriodSec=intervals.reduce((a,b)=>a+b,0)/intervals.length;
  const measuredRespiratoryRatePerMin=60/meanPeriodSec;
  const prescribedRespiratoryRatePerMin=r.snapshot().prescribedRespiratoryRatePerMin;
  const relativeError=(measuredRespiratoryRatePerMin-prescribedRespiratoryRatePerMin)/
    prescribedRespiratoryRatePerMin;

  return {
    dRel,dtSec,settleSec,observeSec,startSec,
    prescribedRespiratoryRatePerMin,
    detectedPeaks:accepted.length,
    meanPeriodSec,
    measuredRespiratoryRatePerMin,
    relativeError,
    status:'OSCILLATION_DETECTED',
    firstPeakSec:accepted[0].t,
    lastPeakSec:accepted[accepted.length-1].t,
    finalState:r.snapshot().state,
  };
}

const cases=[0.2,0.5,0.8].map(dRel=>runCase({dRel}));

const out={
  schema:'hennigs-neural-oscillator-source-reproduction/v1',
  authority:'candidate-not-canonical',
  controlAuthority:false,
  source:{
    citation:'Hennigs C et al. Patient-ventilator interaction—Development of a mathematical model of the respiratory center. Comput Methods Programs Biomed. 2026;280:109329.',
    doi:'10.1016/j.cmpb.2026.109329',
    equations:'Eq.1 oscillator; Eqs.9-10 prescribed RR scaling; Table 2',
  },
  method:{
    event:'local maximum of inspiratory population I after settling',
    note:'No chemical model, Pmus mapping, Vent mechanics, parameter fitting, or target correction is active.',
  },
  cases,
  acceptance:{
    status:'UNASSESSED',
    criterion:'Stable oscillation must exist and measured cycle rate must track the Eq.9 prescribed RR across Drel. A numerical tolerance must be selected from source reproduction and convergence, not by tuning physiology.',
  },
};

const dir=path.resolve(__dirname,'../physician-audit-results');
fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(
  path.join(dir,'hennigs-neural-oscillator-source-reproduction.json'),
  JSON.stringify(out,null,2)+'\n'
);
console.log(JSON.stringify(out,null,2));
