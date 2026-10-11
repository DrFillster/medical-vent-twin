#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {createUrsino1998ClosedLoopRuntime}=
  require('../src/ursino_1998_closed_loop_runtime.js');

const DT_SEC=0.002;
const r=createUrsino1998ClosedLoopRuntime({dtSec:DT_SEC});

function equivalentSystemicResistanceMmHgSecPerMl(s){
  const a=s.hemodynamics.splanchnicResistanceMmHgSecPerMl;
  const b=s.hemodynamics.extrasplanchnicResistanceMmHgSecPerMl;
  return 1/(1/a+1/b);
}

function samplePoint(){
  const s=r.snapshot();
  return {
    timeSec:s.timeSec,
    hrPerMin:s.hemodynamics.heartRatePerMin,
    sapMmHg:s.hemodynamics.systemicArterialPressureMmHg,
    cardiacOutputMlPerSec:s.hemodynamics.leftVentricleOutflowMlPerSec,
    systemicResistanceMmHgSecPerMl:equivalentSystemicResistanceMmHgSecPerMl(s),
    ppaMmHg:s.hemodynamics.pulmonaryArteryPressureMmHg,
    praMmHg:s.hemodynamics.rightAtrialPressureMmHg,
    plaMmHg:s.hemodynamics.leftAtrialPressureMmHg,
    emaxLvMmHgPerMl:s.hemodynamics.EmaxLvMmHgPerMl,
    emaxRvMmHgPerMl:s.hemodynamics.EmaxRvMmHgPerMl,
    vusvMl:s.hemodynamics.splanchnicVenousUnstressedVolumeMl,
    vuevMl:s.hemodynamics.extrasplanchnicVenousUnstressedVolumeMl,
    fCsSpikesPerSec:s.control.fCsSpikesPerSec,
    fEsSpikesPerSec:s.control.fEsSpikesPerSec,
    fEvSpikesPerSec:s.control.fEvSpikesPerSec,
    totalBloodVolumeMl:s.state.Vt,
  };
}

function meanWindow(seconds){
  const n=Math.round(seconds/DT_SEC);
  const sums={};
  for(let i=0;i<n;i++){
    const p=samplePoint();
    for(const [k,v] of Object.entries(p)){
      if(k==='timeSec') continue;
      sums[k]=(sums[k]||0)+v;
    }
    r.step();
  }
  const out={};
  for(const [k,v] of Object.entries(sums)) out[k]=v/n;
  out.startTimeSec=r.snapshot().timeSec-seconds;
  out.endTimeSec=r.snapshot().timeSec;
  return out;
}

function percentChange(after,before,key){
  return 100*(after[key]-before[key])/before[key];
}

// Allow the source model to reach its periodic basal orbit. Initialization is
// not itself an acceptance target.
r.runFor(60);

// Fig. 9 compares mean quantities, so collect a multi-beat basal mean rather
// than a phase-dependent instantaneous ventricular-flow snapshot.
const baseline=meanWindow(5);

// Source protocol: acute hemorrhage of 10% total blood volume performed over 5 s.
const totalLossMl=530;
const hemorrhageSec=5;
const steps=Math.round(hemorrhageSec/DT_SEC);
const lossPerStepMl=totalLossMl/steps;
const hemorrhageStartSec=r.snapshot().timeSec;
for(let i=0;i<steps;i++){
  r.withdrawBloodMl(lossPerStepMl);
  r.step();
}
const hemorrhageEndSec=r.snapshot().timeSec;

// The paper evaluates the response at 80 s from the perturbation. Advance to
// 80 s after hemorrhage onset, then measure a short multi-beat mean window.
const targetSec=hemorrhageStartSec+80;
const remainingSec=targetSec-r.snapshot().timeSec;
r.runFor(Math.round(remainingSec/DT_SEC)*DT_SEC);
const post80=meanWindow(5);

const percentChanges={
  sap:percentChange(post80,baseline,'sapMmHg'),
  cardiacOutput:percentChange(post80,baseline,'cardiacOutputMlPerSec'),
  systemicResistance:percentChange(post80,baseline,'systemicResistanceMmHgSecPerMl'),
  hr:percentChange(post80,baseline,'hrPerMin'),
};

const out={
  schema:'ursino-1998-closed-loop-source-reproduction/v2',
  authority:'candidate-not-canonical',
  source:{
    citation:'Ursino M. Interaction between carotid baroregulation and the pulsating heart: a mathematical model. Am J Physiol Heart Circ Physiol. 1998;275:H1733-H1747.',
    doi:'10.1152/ajpheart.1998.275.5.H1733',
    figure:'Fig. 9',
    protocol:'10% total blood-volume hemorrhage performed over 5 s; source reports mean SAP, CO, total systemic resistance, and HR at 80 s from perturbation.',
  },
  method:{
    dtSec:DT_SEC,
    settleSec:60,
    meanWindowSec:5,
    hemorrhageStartSec,
    hemorrhageEndSec,
    totalLossMl,
    measurementStartSec:post80.startTimeSec,
    measurementEndSec:post80.endTimeSec,
    note:'The 5-s averaging window is an engineering measurement window for a pulsatile model and is not a fitted physiologic parameter.',
  },
  baseline,
  post80,
  percentChanges,
  acceptance:'UNASSESSED: compare percentChanges with source Fig. 9 before any canonical integration.',
};

const dir=path.resolve(__dirname,'../physician-audit-results');
fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(
  path.join(dir,'ursino-1998-closed-loop-challenge.json'),
  JSON.stringify(out,null,2)+'\n'
);
console.log(JSON.stringify(out,null,2));
