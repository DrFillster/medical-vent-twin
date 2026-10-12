#!/usr/bin/env node
'use strict';

const {
  createHumMod2013CardiopulmonaryCompensationCandidate,
}=require('../src/hummod_2013_cardiopulmonary_compensation_candidate.js');

const DT=0.1;
const ECFV_ML=15000;

const BASE=Object.freeze({
  arterialPo2MmHg:94,
  arterialPh:7.44,
  arterialO2ContentMlPerMl:0.196,
  o2MaxMlPerMl:0.200216828201916,
  venousPh:7.37776997729073,
  venousPco2MmHg:44.8382538764693,
  carboxyPercent:0.389637710489589,
  tempC:37,
  cerebralPressureGradientMmHg:89.3625792967117,
  brainPco2MmHg:46.5805596402771,
  brainO2NeedMlPerMin:39.3065407483815,
  plasmaVolumeFraction:0.56,
  glucoseMgPerMl:1.10,
  ketoacidMgPerMl:0.005,
  brainLactateMgPerDl:10,
});

function runStage(c,{label,seconds,inputs}){
  let maxHr=-Infinity;
  let minBrainPo2=Infinity;
  let minFuelDelay=Infinity;
  let maxChemo=-Infinity;
  let maxCns=-Infinity;
  let maxEpi=-Infinity;
  let maxNe=-Infinity;
  let firstOver100Sec=null;
  const start=c.snapshot().timeSec||0;
  const n=Math.round(seconds/DT);
  for(let i=0;i<n;i++){
    const s=c.step(inputs);
    maxHr=Math.max(maxHr,s.heartRatePerMin);
    minBrainPo2=Math.min(minBrainPo2,s.brainFlow.po2MmHg);
    minFuelDelay=Math.min(minFuelDelay,s.cerebralFuel.fractUseDelay);
    maxChemo=Math.max(maxChemo,s.autonomic.chemoreceptor.firingRate);
    maxCns=Math.max(maxCns,s.autonomic.chemoreceptorsCns.effect);
    maxEpi=Math.max(maxEpi,s.epiPgPerMl);
    maxNe=Math.max(maxNe,s.nePgPerMl);
    if(firstOver100Sec==null&&s.heartRatePerMin>100){
      firstOver100Sec=s.timeSec-start;
    }
  }
  const s=c.snapshot();
  return {
    label,
    seconds,
    inputs:Object.freeze({
      arterialPo2MmHg:inputs.arterialPo2MmHg,
      arterialPh:inputs.arterialPh,
      arterialO2ContentMlPerMl:inputs.arterialO2ContentMlPerMl,
      cerebralPressureGradientMmHg:inputs.cerebralPressureGradientMmHg,
    }),
    endpoint:{
      heartRatePerMin:s.heartRatePerMin,
      chemoFiringRate:s.autonomic.chemoreceptor.firingRate,
      chemoCnsEffect:s.autonomic.chemoreceptorsCns.effect,
      cardiacSympatheticHz:s.autonomic.sympathetic.cardiacHz,
      adrenalSympatheticHz:s.autonomic.sympathetic.adrenalHz,
      generalSympatheticHz:s.autonomic.sympathetic.generalHz,
      epiPgPerMl:s.epiPgPerMl,
      nePgPerMl:s.nePgPerMl,
      beta1Effect:s.beta1Effect,
      brainTissuePo2MmHg:s.brainFlow.po2MmHg,
      brainO2UseMlPerMin:s.brainFlow.o2UseMlPerMin,
      brainFuelFractUse:s.cerebralFuel.fuel.fractUse,
      brainFuelFractUseDelay:s.cerebralFuel.fractUseDelay,
    },
    extrema:{
      maximumHeartRatePerMin:maxHr,
      minimumBrainTissuePo2MmHg:minBrainPo2,
      minimumBrainFuelFractUseDelay:minFuelDelay,
      maximumChemoreceptorFiringRate:maxChemo,
      maximumChemoCnsEffect:maxCns,
      maximumEpiPgPerMl:maxEpi,
      maximumNePgPerMl:maxNe,
      firstOver100Sec,
    },
    exceeded100:maxHr>100,
  };
}

const c=createHumMod2013CardiopulmonaryCompensationCandidate({
  dtSec:DT,
  ecfvMl:ECFV_ML,
  initialArterialPh:7.44,
});

const severeHypoxia={...BASE,
  arterialPo2MmHg:30,
  arterialO2ContentMlPerMl:0.08,
  cerebralPressureGradientMmHg:65,
};
const severeAcidemia={...BASE,
  arterialPh:7.10,
};
const combined={...BASE,
  arterialPo2MmHg:30,
  arterialPh:7.10,
  arterialO2ContentMlPerMl:0.08,
  cerebralPressureGradientMmHg:65,
};

const stages=[
  runStage(c,{label:'baseline',seconds:600,inputs:{dtSec:DT,...BASE}}),
  runStage(c,{label:'severe-hypoxia',seconds:600,inputs:{dtSec:DT,...severeHypoxia}}),
  runStage(c,{label:'recovery-1',seconds:600,inputs:{dtSec:DT,...BASE}}),
  runStage(c,{label:'severe-acidemia',seconds:600,inputs:{dtSec:DT,...severeAcidemia}}),
  runStage(c,{label:'recovery-2',seconds:600,inputs:{dtSec:DT,...BASE}}),
  runStage(c,{label:'combined-severe-hypoxia-acidemia',seconds:600,inputs:{dtSec:DT,...combined}}),
  runStage(c,{label:'final-recovery',seconds:900,inputs:{dtSec:DT,...BASE}}),
];

const stress=stages.filter(x=>x.label==='severe-hypoxia'||x.label==='severe-acidemia'||x.label==='combined-severe-hypoxia-acidemia');

console.log(JSON.stringify({
  schema:'hummod-2013-integrated-cardiopulmonary-compensation-audit/v1',
  authority:'candidate-not-canonical',
  canonicalControlAuthority:false,
  physiologyChanged:false,
  sourceOwnership:{
    autonomic:'HumMod 2012/2013 chemoreflex branch',
    cerebralMetabolism:'parallel source-aligned observation only',
  },
  stages,
  summary:{
    anyStressExceeded100:stress.some(x=>x.exceeded100),
    severeHypoxiaExceeded100:stages.find(x=>x.label==='severe-hypoxia').exceeded100,
    severeAcidemiaExceeded100:stages.find(x=>x.label==='severe-acidemia').exceeded100,
    combinedExceeded100:stages.find(x=>x.label==='combined-severe-hypoxia-acidemia').exceeded100,
    maximumStressHeartRatePerMin:Math.max(...stress.map(x=>x.extrema.maximumHeartRatePerMin)),
  },
  limitation:
    'Compensation candidate only. Myocardial oxygen-delivery failure, intracellular acidosis/energetics, contractility depression, and conduction failure are not yet coupled.',
},null,2));
