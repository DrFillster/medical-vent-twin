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

function samplePoint(s=r.snapshot()){
  return {
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

function advanceToBeatBoundary(){
  let prior=r.snapshot().state.phase;
  for(let i=0;i<5000;i++){
    r.step();
    const current=r.snapshot().state.phase;
    if(current<prior) return;
    prior=current;
  }
  throw new Error('failed to find ventricular cycle boundary');
}

// Ursino reports Figs. 3-9 as means from a 20-s stationary tracing,
// selecting an integer number of heart periods and using trapezoidal
// integration. Reproduce that measurement procedure rather than sampling
// a phase-dependent instantaneous value.
function meanOverIntegerHeartPeriods(minTraceSec=20){
  advanceToBeatBoundary();

  const startTimeSec=r.snapshot().timeSec;
  let previousSnapshot=r.snapshot();
  let previousValues=samplePoint(previousSnapshot);
  let previousPhase=previousSnapshot.state.phase;
  const integrals={};
  let beats=0;

  while(true){
    r.step();
    const currentSnapshot=r.snapshot();
    const currentValues=samplePoint(currentSnapshot);

    for(const key of Object.keys(previousValues)){
      integrals[key]=(integrals[key]||0)+
        0.5*(previousValues[key]+currentValues[key])*DT_SEC;
    }

    const wrapped=currentSnapshot.state.phase<previousPhase;
    if(wrapped) beats+=1;

    const elapsedSec=currentSnapshot.timeSec-startTimeSec;
    if(elapsedSec>=minTraceSec&&wrapped){
      const mean={};
      for(const [key,value] of Object.entries(integrals)){
        mean[key]=value/elapsedSec;
      }
      return {
        ...mean,
        traceSec:elapsedSec,
        beats,
        startTimeSec,
        endTimeSec:currentSnapshot.timeSec,
      };
    }

    previousSnapshot=currentSnapshot;
    previousValues=currentValues;
    previousPhase=currentSnapshot.state.phase;
  }
}

function percentChange(after,before,key){
  return 100*(after[key]-before[key])/before[key];
}

// Initialization is not an acceptance target. Permit the candidate to reach
// a stable periodic orbit before collecting the source-style basal mean.
r.runFor(60);
const baseline=meanOverIntegerHeartPeriods(20);

// Primary-source challenge: remove 10% of the 5,300-mL blood volume over 5 s.
const totalLossMl=530;
const hemorrhageSec=5;
const hemorrhageSteps=Math.round(hemorrhageSec/DT_SEC);
const lossPerStepMl=totalLossMl/hemorrhageSteps;
const hemorrhageStartSec=r.snapshot().timeSec;

for(let i=0;i<hemorrhageSteps;i++){
  r.withdrawBloodMl(lossPerStepMl);
  r.step();
}

const hemorrhageEndSec=r.snapshot().timeSec;

// Source results are evaluated 80 s after the perturbation. Advance to that
// point and then collect the source-style stationary mean tracing.
const targetEvaluationSec=hemorrhageStartSec+80;
const remainingSec=targetEvaluationSec-r.snapshot().timeSec;
if(remainingSec>0){
  r.runFor(Math.round(remainingSec/DT_SEC)*DT_SEC);
}
const post80=meanOverIntegerHeartPeriods(20);

const percentChanges={
  sap:percentChange(post80,baseline,'sapMmHg'),
  cardiacOutput:percentChange(post80,baseline,'cardiacOutputMlPerSec'),
  systemicResistance:percentChange(
    post80,baseline,'systemicResistanceMmHgSecPerMl'
  ),
  hr:percentChange(post80,baseline,'hrPerMin'),
};

const out={
  schema:'ursino-1998-closed-loop-source-reproduction/v3',
  authority:'candidate-not-canonical',
  source:{
    citation:'Ursino M. Interaction between carotid baroregulation and the pulsating heart: a mathematical model. Am J Physiol Heart Circ Physiol. 1998;275:H1733-H1747.',
    doi:'10.1152/ajpheart.1998.275.5.H1733',
    figure:'Fig. 9',
    protocol:'10% total blood-volume hemorrhage performed over 5 s; evaluate after 80 s.',
    measurement:'Figs. 3-9 use a 20-s stationary tracing, an integer number of heart periods, and trapezoidal time averaging.',
  },
  method:{
    dtSec:DT_SEC,
    settleSec:60,
    minimumMeanTraceSec:20,
    hemorrhageStartSec,
    hemorrhageEndSec,
    totalLossMl,
    targetEvaluationSec,
    note:'No physiologic parameter is fitted by this harness. The 2-ms RK4 step is a numerical implementation choice; source used adaptive RKF with <=0.01-s integration/memorization steps and 1e-6 error tolerance.',
  },
  baseline,
  post80,
  percentChanges,
  acceptance:'UNASSESSED: compare percentChanges with reproducibly transcribed primary-source Fig. 9 model bars before canonical integration.',
};

const dir=path.resolve(__dirname,'../physician-audit-results');
fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(
  path.join(dir,'ursino-1998-closed-loop-challenge.json'),
  JSON.stringify(out,null,2)+'\n'
);
console.log(JSON.stringify(out,null,2));
