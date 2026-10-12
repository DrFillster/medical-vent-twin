#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {
  createUrsinoMagosso2000ExpandedHypoxiaClosedLoop,
}=require('../src/ursino_magosso_2000_expanded_hypoxia_closed_loop.js');

const DT=0.002;

function flows(s){
  const p=s.vascularState,e=s.vascularEffectors;
  return {
    autoregulatedMlPerSec:
      (p.Psp-p.Pmv)/e.Rmp+
      (p.Psp-p.Pbv)/e.Rbp+
      (p.Psp-p.Phv)/e.Rhp,
    remainingMlPerSec:
      (p.Psp-p.Psv)/e.Rsp+
      (p.Psp-p.Pev)/e.Rep,
  };
}

function meanWindow(r,seconds){
  const n=Math.round(seconds/DT);
  const sum={
    hr:0,map:0,co:0,vt:0,autoregulated:0,remaining:0,
    fAb:0,fAc:0,fAp:0,thetaSp:0,thetaSh:0,fSp:0,fSh:0,fV:0,
    Rsp:0,Rep:0,Rmp:0,Rbp:0,Rhp:0,Vusv:0,Vuev:0,Vumv:0,
  };
  for(let i=0;i<n;i++){
    const s=r.snapshot();
    const f=flows(s);
    sum.hr+=s.hemodynamics.heartRatePerMin;
    sum.map+=s.hemodynamics.systemicArterialPressureMmHg;
    sum.co+=s.hemodynamics.leftVentricleOutflowMlPerSec;
    sum.vt+=s.ventilation.activeTidalVolumeL;
    sum.autoregulated+=f.autoregulatedMlPerSec;
    sum.remaining+=f.remainingMlPerSec;
    if(s.autonomic){
      sum.fAb+=s.autonomic.fAbSpikesPerSec;
      sum.fAc+=s.autonomic.fAcSpikesPerSec;
      sum.fAp+=s.autonomic.fApSpikesPerSec;
      sum.thetaSp+=s.autonomic.thetaSpSpikesPerSec;
      sum.thetaSh+=s.autonomic.thetaShSpikesPerSec;
      sum.fSp+=s.autonomic.fSpSpikesPerSec;
      sum.fSh+=s.autonomic.fShSpikesPerSec;
      sum.fV+=s.autonomic.fVSpikesPerSec;
    }
    const e=s.vascularEffectors;
    sum.Rsp+=e.Rsp; sum.Rep+=e.Rep; sum.Rmp+=e.Rmp;
    sum.Rbp+=e.Rbp; sum.Rhp+=e.Rhp;
    sum.Vusv+=e.Vusv; sum.Vuev+=e.Vuev; sum.Vumv+=e.Vumv;
    r.step();
  }
  for(const k of Object.keys(sum)) sum[k]/=n;
  return sum;
}

function pct(x,b){return 100*(x-b)/b;}
function changes(x,b){
  const out={};
  for(const k of Object.keys(b)) out[k]=pct(x[k],b[k]);
  return out;
}

const r=createUrsinoMagosso2000ExpandedHypoxiaClosedLoop({
  dtSec:DT,
  pao2MmHg:95,
  paco2MmHg:40,
  ventilationMode:'ursino-magosso-2000-spontaneous-validation',
});

// Initialization is not an acceptance target. Reach a periodic basal state.
r.runFor(120);
const baseline=meanWindow(r,5);

// Source Fig. 11 protocol: lower PaO2 from 95 to 28 mmHg over 10 s.
const rampSec=10;
const rampSteps=Math.round(rampSec/DT);
let earlyAccumulator={
  hr:0,map:0,co:0,vt:0,autoregulated:0,remaining:0,
  fAb:0,fAc:0,fAp:0,thetaSp:0,thetaSh:0,fSp:0,fSh:0,fV:0,
  Rsp:0,Rep:0,Rmp:0,Rbp:0,Rhp:0,Vusv:0,Vuev:0,Vumv:0,
};
let earlyN=0;

for(let i=0;i<rampSteps;i++){
  const elapsed=i*DT;
  const fraction=elapsed/rampSec;
  const pao2=95+(28-95)*fraction;
  r.setEnvironment({pao2MmHg:pao2,paco2MmHg:40});
  const s=r.snapshot();

  // Source describes the early phase at 8-10 s.
  if(elapsed>=8){
    const f=flows(s);
    earlyAccumulator.hr+=s.hemodynamics.heartRatePerMin;
    earlyAccumulator.map+=s.hemodynamics.systemicArterialPressureMmHg;
    earlyAccumulator.co+=s.hemodynamics.leftVentricleOutflowMlPerSec;
    earlyAccumulator.vt+=s.ventilation.activeTidalVolumeL;
    earlyAccumulator.autoregulated+=f.autoregulatedMlPerSec;
    earlyAccumulator.remaining+=f.remainingMlPerSec;
    if(s.autonomic){
      earlyAccumulator.fAb+=s.autonomic.fAbSpikesPerSec;
      earlyAccumulator.fAc+=s.autonomic.fAcSpikesPerSec;
      earlyAccumulator.fAp+=s.autonomic.fApSpikesPerSec;
      earlyAccumulator.thetaSp+=s.autonomic.thetaSpSpikesPerSec;
      earlyAccumulator.thetaSh+=s.autonomic.thetaShSpikesPerSec;
      earlyAccumulator.fSp+=s.autonomic.fSpSpikesPerSec;
      earlyAccumulator.fSh+=s.autonomic.fShSpikesPerSec;
      earlyAccumulator.fV+=s.autonomic.fVSpikesPerSec;
    }
    const e=s.vascularEffectors;
    earlyAccumulator.Rsp+=e.Rsp; earlyAccumulator.Rep+=e.Rep;
    earlyAccumulator.Rmp+=e.Rmp; earlyAccumulator.Rbp+=e.Rbp;
    earlyAccumulator.Rhp+=e.Rhp; earlyAccumulator.Vusv+=e.Vusv;
    earlyAccumulator.Vuev+=e.Vuev; earlyAccumulator.Vumv+=e.Vumv;
    earlyN++;
  }
  r.step();
}
r.setEnvironment({pao2MmHg:28,paco2MmHg:40});

const early={};
for(const k of Object.keys(earlyAccumulator)){
  early[k]=earlyAccumulator[k]/earlyN;
}

// Later source phase: sample 20-30 s after perturbation onset.
r.runFor(10);
const later=meanWindow(r,10);

// Source also states mean SAP and HR increase within 1 min from onset.
r.runFor(20);
const withinMinute=meanWindow(r,10);

const out={
  schema:'ursino-magosso-2000-fig11-expanded-reproduction/v1',
  authority:'source-reproduction-candidate-not-canonical',
  source:{
    citation:'Ursino M, Magosso E. Am J Physiol Heart Circ Physiol. 2000;279:H149-H165.',
    doi:'10.1152/ajpheart.2000.279.1.H149',
    figure:'Fig. 11',
    protocol:'PaO2 lowered from 95 to 28 mmHg over 10 s and then maintained; isocapnic.',
  },
  method:{
    dtSec:DT,
    settleSec:120,
    baselineMeanSec:5,
    earlyWindowSec:[8,10],
    laterWindowSec:[20,30],
    withinMinuteWindowSec:[50,60],
    paCO2MmHg:40,
    ventilationMode:'ursino-magosso-2000-spontaneous-validation',
  },
  baseline,
  early,
  later,
  withinMinute,
  percentChanges:{
    early:changes(early,baseline),
    later:changes(later,baseline),
    withinMinute:changes(withinMinute,baseline),
  },
};

const dir=path.resolve(__dirname,'../physician-audit-results');
fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(
  path.join(dir,'ursino-magosso-2000-fig11-expanded-reproduction.json'),
  JSON.stringify(out,null,2)+'\n'
);
console.log(JSON.stringify(out,null,2));
