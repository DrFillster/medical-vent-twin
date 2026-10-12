#!/usr/bin/env node
'use strict';

const {
  createHumModCardiopulmonaryCompensationCandidate,
}=require('../src/hummod_cardiopulmonary_compensation_candidate.js');
const {
  createHumModSympathoadrenalSaNodeCandidate,
}=require('../src/hummod_sympathoadrenal_sa_node_candidate.js');

const DT=0.1;
const ECFV_ML=15000;
const BASELINE={
  arterialPo2MmHg:94.009870530838,
  arterialO2ContentMlPerMl:0.196,
  o2MaxMlPerMl:0.200216828201916,
  venousPh:7.37776997729073,
  venousPco2MmHg:44.8382538764693,
  carboxyPercent:0.389637710489589,
  tempC:37,
  cerebralPressureGradientMmHg:89.3625792967117,
  brainPco2MmHg:46.5805596402771,
  brainO2NeedMlPerMin:39.3065407483815,
  carotidPressureMmHg:97,
};
const SEVERE={
  arterialPo2MmHg:14.066113617021,
  arterialO2ContentMlPerMl:0.0360374485928025,
  o2MaxMlPerMl:0.199888902293675,
  venousPh:7.36136678069273,
  venousPco2MmHg:46.518495684341,
  carboxyPercent:0.390941669136932,
  tempC:37.0281783660784,
  cerebralPressureGradientMmHg:55.4181007568852,
  brainPco2MmHg:51.1215816129238,
  brainO2NeedMlPerMin:39.5553369473497,
  carotidPressureMmHg:60,
};
const COMMON={
  plasmaVolumeFraction:0.56,
  glucoseMgPerMl:1.10,
  ketoacidMgPerMl:0.005,
};

function summarizeEndToEnd(lactate){
  const r=createHumModCardiopulmonaryCompensationCandidate({
    dtSec:DT,
    ecfvMl:ECFV_ML,
    initialCarotidPressureMmHg:97,
  });
  const common={...COMMON,brainLactateMgPerDl:lactate};
  r.runFor(120,{...BASELINE,...common});
  const b=r.snapshot();
  let minFuel=Infinity,minDelay=Infinity,maxSymps=-Infinity,maxBeta=-Infinity,maxEpi=-Infinity,maxHr=-Infinity;
  const n=Math.round(180/DT);
  for(let i=0;i<n;i++){
    const s=r.step({...SEVERE,...common});
    minFuel=Math.min(minFuel,s.brainFuel.fuel.fractUse);
    minDelay=Math.min(minDelay,s.brainFuel.fractUseDelay);
    maxSymps=Math.max(maxSymps,s.sympathoadrenalSaNode.sympsCnsHz);
    maxBeta=Math.max(maxBeta,s.betaEffect);
    maxEpi=Math.max(maxEpi,s.epiPgPerMl);
    maxHr=Math.max(maxHr,s.heartRatePerMin);
  }
  const e=r.snapshot();
  return {
    lactateMgPerDl:lactate,
    baseline:{
      fractUse:b.brainFuel.fuel.fractUse,
      fractUseDelay:b.brainFuel.fractUseDelay,
      sympsCnsHz:b.sympathoadrenalSaNode.sympsCnsHz,
      betaEffect:b.betaEffect,
      epiPgPerMl:b.epiPgPerMl,
      heartRatePerMin:b.heartRatePerMin,
    },
    severeExtrema:{
      minimumFractUse:minFuel,
      minimumFractUseDelay:minDelay,
      maximumSympsCnsHz:maxSymps,
      maximumBetaEffect:maxBeta,
      maximumEpiPgPerMl:maxEpi,
      maximumHeartRatePerMin:maxHr,
    },
    severeEndpoint:{
      fractUse:e.brainFuel.fuel.fractUse,
      fractUseDelay:e.brainFuel.fractUseDelay,
      sympsCnsHz:e.sympathoadrenalSaNode.sympsCnsHz,
      betaEffect:e.betaEffect,
      epiPgPerMl:e.epiPgPerMl,
      heartRatePerMin:e.heartRatePerMin,
    },
  };
}

function directReference(){
  const c=createHumModSympathoadrenalSaNodeCandidate({
    ecfvMl:ECFV_ML,
    initialCarotidPressureMmHg:97,
  });
  c.runFor(120,{
    dtSec:DT,
    carotidPressureMmHg:97,
    averageAtrialTmpMmHg:6,
    brainFuelFractUseDelay:1,
    brainFunctionEffect:1,
    sympsChemoEffect:1,
    otherTissueFunctionEffect:1,
  });
  let maxHr=-Infinity,maxSymps=-Infinity,maxBeta=-Infinity,maxEpi=-Infinity;
  const n=Math.round(120/DT);
  for(let i=0;i<n;i++){
    const s=c.step({
      dtSec:DT,
      carotidPressureMmHg:60,
      averageAtrialTmpMmHg:6,
      brainFuelFractUseDelay:0.6,
      brainFunctionEffect:1,
      sympsChemoEffect:1,
      otherTissueFunctionEffect:1,
    });
    maxHr=Math.max(maxHr,s.heartRatePerMin);
    maxSymps=Math.max(maxSymps,s.sympsCnsHz);
    maxBeta=Math.max(maxBeta,s.catecholamines.betaEffect);
    maxEpi=Math.max(maxEpi,s.catecholamines.epiPgPerMl);
  }
  return {
    suppliedBrainFuelFractUseDelay:0.6,
    pressureMmHg:60,
    maximumHeartRatePerMin:maxHr,
    maximumSympsCnsHz:maxSymps,
    maximumBetaEffect:maxBeta,
    maximumEpiPgPerMl:maxEpi,
    endpoint:c.snapshot(),
  };
}

console.log(JSON.stringify({
  schema:'v15-brain-fuel-signal-gap-audit/v1',
  authority:'diagnostic-only',
  physiologyChanged:false,
  directQualifiedReference:directReference(),
  endToEnd:[10,30,60,100].map(summarizeEndToEnd),
  interpretation:
    'Compare generated FractUse/FractUseDelay and downstream SympsCNS/catecholamine/HR with the already-qualified direct Brain-Fuel stress reference. No parameter fitting is performed.',
},null,2));
