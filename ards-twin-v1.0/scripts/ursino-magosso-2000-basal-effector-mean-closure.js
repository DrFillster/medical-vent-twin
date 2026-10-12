#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {
  createUrsinoMagosso2000ExpandedHypoxiaClosedLoop,
}=require('../src/ursino_magosso_2000_expanded_hypoxia_closed_loop.js');
const {
  sourceTargets,
}=require('../src/ursino_magosso_2000_split_effectors_candidate.js');

const DT=0.002;

function zero(){
  return {
    heartPeriod:0,EmaxLv:0,EmaxRv:0,Rsp:0,Rep:0,
    Vusv:0,Vuev:0,Vumv:0,
  };
}
function add(dst,src){
  for(const k of Object.keys(dst)) dst[k]+=src[k];
}
function divide(x,n){
  const out={};
  for(const [k,v] of Object.entries(x)) out[k]=v/n;
  return out;
}

const r=createUrsinoMagosso2000ExpandedHypoxiaClosedLoop({
  dtSec:DT,pao2MmHg:95,paco2MmHg:40,
  ventilationMode:'ursino-magosso-2000-spontaneous-validation',
});
r.runFor(180);

const n=Math.round(60/DT);
const actualSum=zero();
const targetSum=zero();
let hrSum=0;

for(let i=0;i<n;i++){
  const s=r.snapshot();
  const a=s.autonomic;
  const e=s.vascularEffectors;
  const target=sourceTargets({
    vascularSympatheticSpikesPerSec:a.fSpSpikesPerSec,
    cardiacSympatheticSpikesPerSec:a.fShSpikesPerSec,
    cardiacVagalSpikesPerSec:a.fVSpikesPerSec,
  }).absolute;

  add(actualSum,{
    heartPeriod:e.heartPeriodSec,
    EmaxLv:e.EmaxLv,EmaxRv:e.EmaxRv,
    Rsp:e.Rsp,Rep:e.Rep,
    Vusv:e.Vusv,Vuev:e.Vuev,Vumv:e.Vumv,
  });
  add(targetSum,{
    heartPeriod:target.heartPeriodSec,
    EmaxLv:target.EmaxLv,EmaxRv:target.EmaxRv,
    Rsp:target.Rsp,Rep:target.Rep,
    Vusv:target.Vusv,Vuev:target.Vuev,Vumv:target.Vumv,
  });
  hrSum+=s.hemodynamics.heartRatePerMin;
  r.step();
}

const actual=divide(actualSum,n);
const meanInstantaneousTarget=divide(targetSum,n);
const residual={};
const percentResidual={};
for(const k of Object.keys(actual)){
  residual[k]=actual[k]-meanInstantaneousTarget[k];
  percentResidual[k]=100*residual[k]/meanInstantaneousTarget[k];
}

const out={
  schema:'ursino-magosso-2000-basal-effector-mean-closure/v1',
  authority:'source-reproduction-diagnostic-only',
  method:{
    dtSec:DT,settleSec:180,meanWindowSec:60,
    note:'Pure delays change phase but not stationary periodic mean. First-order source effectors should therefore have mean output equal to mean time-varying static target after settling.',
  },
  meanHeartRatePerMin:hrSum/n,
  actualMean:actual,
  meanInstantaneousSourceTarget,
  residual,
  percentResidual,
};

const dir=path.resolve(__dirname,'../physician-audit-results');
fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(
  path.join(dir,'ursino-magosso-2000-basal-effector-mean-closure.json'),
  JSON.stringify(out,null,2)+'\n'
);
console.log(JSON.stringify(out,null,2));
