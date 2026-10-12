#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {
  createUrsinoMagosso2000ExpandedHypoxiaClosedLoop,
}=require('../src/ursino_magosso_2000_expanded_hypoxia_closed_loop.js');
const {
  LOCAL,
}=require('../src/ursino_magosso_2000_local_o2_candidate.js');
const {
  P:O2_P,
  arterialO2ConcentrationMlO2PerMlBlood,
}=require('../src/ursino_magosso_2000_oxygen_metabolic_candidate.js');

const DT=0.002;

function blankBed(){
  return {flow:0,venousO2:0,target:0,state:0,resistance:0,consumption:0};
}

function collectMean(r,seconds){
  const n=Math.round(seconds/DT);
  const sum={
    arterialO2:0,
    brain:blankBed(),
    heart:blankBed(),
    muscle:blankBed(),
    pumpPower:0,
  };
  for(let i=0;i<n;i++){
    const s=r.snapshot();
    const l=s.localO2;
    sum.arterialO2+=l.arterialO2MlPerMl;
    sum.pumpPower+=s.averagePumpPowerMmHgMlPerSec;
    for(const bed of ['brain','heart','muscle']){
      const flowKey=bed==='heart'?'coronaryFlowMlPerSec':bed+'FlowMlPerSec';
      sum[bed].flow+=l.inputs[flowKey];
      sum[bed].venousO2+=l.venousO2MlPerMl[bed];
      sum[bed].target+=l.target[bed];
      sum[bed].state+=l.localState[bed];
      sum[bed].resistance+=l.resistanceMmHgSecPerMl[bed];
      sum[bed].consumption+=l.oxygenConsumptionMlPerSec[bed];
    }
    r.step();
  }
  sum.arterialO2/=n;
  sum.pumpPower/=n;
  for(const bed of ['brain','heart','muscle']){
    for(const key of Object.keys(sum[bed])) sum[bed][key]/=n;
  }
  return sum;
}

function addSourceComparison(mean){
  const out={};
  for(const bed of ['brain','heart','muscle']){
    const normalCv=LOCAL[bed].normalVenousO2MlPerMl;
    const actualConsumption=mean[bed].consumption;
    const basalConsumption=bed==='brain'
      ?O2_P.metabolism.brainO2ConsumptionMlPerSec
      :bed==='muscle'
        ?O2_P.metabolism.muscleO2ConsumptionMlPerSec
        :O2_P.metabolism.heartBasalO2ConsumptionMlPerSec;
    const denominator=mean.arterialO2-normalCv;
    out[bed]={
      normalVenousO2MlPerMl:normalCv,
      actualVenousO2MlPerMl:mean[bed].venousO2,
      venousO2Difference:mean[bed].venousO2-normalCv,
      venousO2PercentDifference:
        100*(mean[bed].venousO2-normalCv)/normalCv,
      localTarget:mean[bed].target,
      localState:mean[bed].state,
      actualFlowMlPerSec:mean[bed].flow,
      actualConsumptionMlPerSec:actualConsumption,
      sourceBasalConsumptionMlPerSec:basalConsumption,
      impliedFlowUsingActualConsumptionMlPerSec:
        actualConsumption/denominator,
      impliedFlowUsingSourceBasalConsumptionMlPerSec:
        basalConsumption/denominator,
      actualToImpliedActualConsumptionFlowRatio:
        mean[bed].flow/(actualConsumption/denominator),
    };
  }
  return out;
}

const r=createUrsinoMagosso2000ExpandedHypoxiaClosedLoop({
  dtSec:DT,
  pao2MmHg:95,
  paco2MmHg:40,
  ventilationMode:'ursino-magosso-2000-spontaneous-validation',
});

r.runFor(180);
const mean=collectMean(r,20);
const comparison=addSourceComparison(mean);

const out={
  schema:'ursino-magosso-2000-basal-local-o2-fixed-point/v1',
  authority:'source-reproduction-diagnostic-only',
  source:{
    doi:'10.1152/ajpheart.2000.279.1.H149',
    equations:[41,42,43],
    definition:'CvO2,n and Rj,pn are normal-condition values when blood flow, PaO2, and tissue metabolism are basal.',
  },
  method:{
    dtSec:DT,
    settleSec:180,
    meanWindowSec:20,
    pao2MmHg:95,
    paco2MmHg:40,
    ventilationMode:'ursino-magosso-2000-spontaneous-validation',
  },
  arterialO2MlPerMl:mean.arterialO2,
  sourceArterialO2At95MlPerMl:
    arterialO2ConcentrationMlO2PerMlBlood({pao2MmHg:95,paco2MmHg:40}),
  averagePumpPowerMmHgMlPerSec:mean.pumpPower,
  sourceBasalPumpPowerMmHgMlPerSec:
    O2_P.metabolism.heartBasalPowerMmHgMlPerSec,
  beds:comparison,
};

const dir=path.resolve(__dirname,'../physician-audit-results');
fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(
  path.join(dir,'ursino-magosso-2000-basal-local-o2-fixed-point.json'),
  JSON.stringify(out,null,2)+'\n'
);
console.log(JSON.stringify(out,null,2));
