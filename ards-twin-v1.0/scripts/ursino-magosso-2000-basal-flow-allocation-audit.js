#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {
  createUrsinoMagosso2000ExpandedHypoxiaClosedLoop,
}=require('../src/ursino_magosso_2000_expanded_hypoxia_closed_loop.js');
const {
  arterialO2ConcentrationMlO2PerMlBlood,
  P:O2_P,
}=require('../src/ursino_magosso_2000_oxygen_metabolic_candidate.js');

const DT=0.002;

function mean20(r){
  const n=Math.round(20/DT);
  const sum={co:0,brain:0,heart:0,muscle:0};
  for(let i=0;i<n;i++){
    const s=r.snapshot();
    const p=s.vascularState,e=s.vascularEffectors;
    sum.co+=s.hemodynamics.leftVentricleOutflowMlPerSec;
    sum.brain+=(p.Psp-p.Pbv)/e.Rbp;
    sum.heart+=(p.Psp-p.Phv)/e.Rhp;
    sum.muscle+=(p.Psp-p.Pmv)/e.Rmp;
    r.step();
  }
  for(const k of Object.keys(sum)) sum[k]/=n;
  return sum;
}

const r=createUrsinoMagosso2000ExpandedHypoxiaClosedLoop({
  dtSec:DT,pao2MmHg:95,paco2MmHg:40,
  ventilationMode:'ursino-magosso-2000-spontaneous-validation',
});
r.runFor(180);
const actual=mean20(r);

const ca=arterialO2ConcentrationMlO2PerMlBlood({
  pao2MmHg:95,paco2MmHg:40,
});

const impliedFlow={
  brain:O2_P.metabolism.brainO2ConsumptionMlPerSec/(ca-0.14),
  heart:O2_P.metabolism.heartBasalO2ConsumptionMlPerSec/(ca-0.11),
  muscle:O2_P.metabolism.muscleO2ConsumptionMlPerSec/(ca-0.155),
};

const out={
  schema:'ursino-magosso-2000-basal-flow-allocation-audit/v1',
  authority:'source-reproduction-diagnostic-only',
  source:{
    doi:'10.1152/ajpheart.2000.279.1.H149',
    statedBasalFractions:{
      brain:[0.14,0.15],
      coronary:[0.04,0.05],
      skeletalMuscleApprox:0.22,
    },
    note:'Primary source states these branch parameters were assigned assuming these normal fractions of total cardiac output.',
  },
  method:{
    dtSec:DT,
    settleSec:180,
    meanWindowSec:20,
    pao2MmHg:95,
    paco2MmHg:40,
  },
  arterialO2MlPerMl:ca,
  actual:{
    ...actual,
    fractions:{
      brain:actual.brain/actual.co,
      coronary:actual.heart/actual.co,
      skeletalMuscle:actual.muscle/actual.co,
    },
  },
  sourceFixedPointImplied:{
    bedFlowMlPerSec:impliedFlow,
    cardiacOutputMlPerSec:{
      brainAt15Pct:impliedFlow.brain/0.15,
      brainAt14Pct:impliedFlow.brain/0.14,
      coronaryAt5Pct:impliedFlow.heart/0.05,
      coronaryAt4Pct:impliedFlow.heart/0.04,
      skeletalMuscleAt22Pct:impliedFlow.muscle/0.22,
    },
  },
};

const dir=path.resolve(__dirname,'../physician-audit-results');
fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(
  path.join(dir,'ursino-magosso-2000-basal-flow-allocation-audit.json'),
  JSON.stringify(out,null,2)+'\n'
);
console.log(JSON.stringify(out,null,2));
