#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {
  createUrsino1998ClosedLoopRuntime,
}=require('../src/ursino_1998_closed_loop_runtime.js');

const DT_SEC=0.002;

function equivalentPeripheralResistance(s){
  const rsp=s.hemodynamics.splanchnicResistanceMmHgSecPerMl;
  const rep=s.hemodynamics.extrasplanchnicResistanceMmHgSecPerMl;
  return 1/(1/rsp+1/rep);
}

function measured(s){
  return {
    sapMmHg:s.hemodynamics.systemicArterialPressureMmHg,
    cardiacOutputMlPerSec:s.hemodynamics.leftVentricleOutflowMlPerSec,
    peripheralResistanceMmHgSecPerMl:equivalentPeripheralResistance(s),
    hrPerMin:s.hemodynamics.heartRatePerMin,
  };
}

function advanceToBeatBoundary(r){
  let prior=r.snapshot().state.phase;
  for(let i=0;i<5000;i++){
    r.step();
    const current=r.snapshot().state.phase;
    if(current<prior) return;
    prior=current;
  }
  throw new Error('failed to find ventricular cycle boundary');
}

function meanOverIntegerHeartPeriods(r,minTraceSec=20){
  advanceToBeatBoundary(r);
  const start=r.snapshot().timeSec;
  let priorSnapshot=r.snapshot();
  let priorValues=measured(priorSnapshot);
  let priorPhase=priorSnapshot.state.phase;
  const integrals={};
  let beats=0;

  for(;;){
    r.step();
    const currentSnapshot=r.snapshot();
    const currentValues=measured(currentSnapshot);

    for(const key of Object.keys(priorValues)){
      integrals[key]=(integrals[key]||0)+
        0.5*(priorValues[key]+currentValues[key])*DT_SEC;
    }

    const wrapped=currentSnapshot.state.phase<priorPhase;
    if(wrapped) beats+=1;
    const elapsed=currentSnapshot.timeSec-start;

    if(elapsed>=minTraceSec&&wrapped){
      const out={};
      for(const [key,value] of Object.entries(integrals)){
        out[key]=value/elapsed;
      }
      return {...out,traceSec:elapsed,beats};
    }

    priorSnapshot=currentSnapshot;
    priorValues=currentValues;
    priorPhase=currentSnapshot.state.phase;
  }
}

function percentChanges(after,before){
  const out={};
  for(const key of [
    'sapMmHg','cardiacOutputMlPerSec',
    'peripheralResistanceMmHgSecPerMl','hrPerMin',
  ]){
    out[key]=100*(after[key]-before[key])/before[key];
  }
  return out;
}

function runCase(controlStrength,initialState,baseline){
  const r=createUrsino1998ClosedLoopRuntime({
    dtSec:DT_SEC,
    controlStrength,
    initialState,
  });

  const hemorrhageStartSec=r.snapshot().timeSec;

  const steps=Math.round(5/DT_SEC);
  for(let i=0;i<steps;i++){
    r.withdrawBloodMl(530/steps);
    r.step();
  }

  const targetSec=hemorrhageStartSec+80;
  const remainingSec=targetSec-r.snapshot().timeSec;
  if(remainingSec>0){
    r.runFor(Math.round(remainingSec/DT_SEC)*DT_SEC);
  }

  const post80=meanOverIntegerHeartPeriods(r,20);
  return {
    controlStrength,
    baseline,
    post80,
    percentChanges:percentChanges(post80,baseline),
  };
}

const cases={
  intact:{},
  noVenousUnstressedVolume:{unstressedVolume:0},
  noPeripheralResistance:{resistance:0},
  noHeartPeriod:{heartPeriod:0},
  noEmax:{Emax:0},
};

// Establish one intact basal orbit, measure it once, then branch every
// sensitivity case from the same post-measurement state. This matches the
// source requirement that the mechanism is disabled without changing the
// basal state before the hemorrhage challenge.
const basalRuntime=createUrsino1998ClosedLoopRuntime({dtSec:DT_SEC});
basalRuntime.runFor(60);
const commonBaseline=meanOverIntegerHeartPeriods(basalRuntime,20);
const commonInitialState={...basalRuntime.snapshot().state};

const results={};
for(const [name,strength] of Object.entries(cases)){
  results[name]=runCase(strength,commonInitialState,commonBaseline);
}

const intact=results.intact.percentChanges;
function addedDeterioration(caseName,key){
  return Math.abs(results[caseName].percentChanges[key]-intact[key]);
}

const ordering={
  sapAddedDeterioration:{
    noVenousUnstressedVolume:addedDeterioration(
      'noVenousUnstressedVolume','sapMmHg'
    ),
    noPeripheralResistance:addedDeterioration(
      'noPeripheralResistance','sapMmHg'
    ),
    noHeartPeriod:addedDeterioration('noHeartPeriod','sapMmHg'),
    noEmax:addedDeterioration('noEmax','sapMmHg'),
  },
  coAddedDeterioration:{
    noVenousUnstressedVolume:addedDeterioration(
      'noVenousUnstressedVolume','cardiacOutputMlPerSec'
    ),
    noPeripheralResistance:addedDeterioration(
      'noPeripheralResistance','cardiacOutputMlPerSec'
    ),
    noHeartPeriod:addedDeterioration(
      'noHeartPeriod','cardiacOutputMlPerSec'
    ),
    noEmax:addedDeterioration('noEmax','cardiacOutputMlPerSec'),
  },
};

const out={
  schema:'ursino-1998-fig9-effector-sensitivity/v1',
  authority:'candidate-not-canonical',
  source:{
    citation:'Ursino M. Interaction between carotid baroregulation and the pulsating heart: a mathematical model. Am J Physiol Heart Circ Physiol. 1998;275:H1733-H1747.',
    doi:'10.1152/ajpheart.1998.275.5.H1733',
    figure:'Fig. 9, bottom panel',
    rule:'Each effector control strength is reduced to zero individually while preserving the same basal control state.',
  },
  results,
  ordering,
  acceptance:{
    expected:'Venous unstressed-volume control has the largest early protective role; resistance and heart-period controls are less important; Emax control is minor.',
    quantitative:'UNASSESSED pending reproducible digitization of primary-source Fig. 9 bars.',
  },
};

const dir=path.resolve(__dirname,'../physician-audit-results');
fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(
  path.join(dir,'ursino-1998-fig9-effector-sensitivity.json'),
  JSON.stringify(out,null,2)+'\n'
);
console.log(JSON.stringify(out,null,2));
