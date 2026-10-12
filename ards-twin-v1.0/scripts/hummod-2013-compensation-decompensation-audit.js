#!/usr/bin/env node
'use strict';

const {
  sourceSizingFromReference,
}=require('../src/hummod_2013_left_heart_pump_candidate.js');
const {
  createHumMod2013CompensationDecompensationCandidate,
}=require('../src/hummod_2013_compensation_decompensation_candidate.js');

const DT=0.1;
const sizing=sourceSizingFromReference({
  sourceCardiacOutputMlPerMin:5000,
  leftHeartMassG:300,
  systemicArteryTotalVolumeMl:1000,
});

const c=createHumMod2013CompensationDecompensationCandidate({
  ecfvMl:15000,
  sourceSizing:sizing,
  initialArterialPh:7.44,
});

const BASE={
  dtSec:DT,
  arterialPo2MmHg:94,
  arterialPh:7.44,
  myocardialIntracellularPh:7.0,
  meanArterialPressureMmHg:87,
  leftAtrialPressureMmHg:5.5,
  pericardialPressureMmHg:-4,
};

function stage(label,seconds,inputs){
  const n=Math.round(seconds/DT);
  let maxHr=-Infinity,minSv=Infinity,minCo=Infinity,minContractility=Infinity;
  let maxCardiacSymps=-Infinity,maxEpi=-Infinity;
  for(let i=0;i<n;i++){
    const s=c.step(inputs);
    maxHr=Math.max(maxHr,s.heartRatePerMin);
    minSv=Math.min(minSv,s.strokeVolumeMl);
    minCo=Math.min(minCo,s.cardiacOutputMlPerMin);
    minContractility=Math.min(minContractility,s.leftHeartContractility.contractility);
    maxCardiacSymps=Math.max(maxCardiacSymps,s.autonomic.sympathetic.cardiacHz);
    maxEpi=Math.max(maxEpi,s.autonomic.catecholamines.epiPgPerMl);
  }
  const s=c.snapshot();
  return {
    label,
    seconds,
    inputs:{
      arterialPo2MmHg:inputs.arterialPo2MmHg,
      arterialPh:inputs.arterialPh,
      myocardialIntracellularPh:inputs.myocardialIntracellularPh,
      meanArterialPressureMmHg:inputs.meanArterialPressureMmHg,
    },
    endpoint:{
      heartRatePerMin:s.heartRatePerMin,
      cardiacSympatheticHz:s.autonomic.sympathetic.cardiacHz,
      epinephrinePgPerMl:s.autonomic.catecholamines.epiPgPerMl,
      beta1Effect:s.autonomic.catecholamines.beta1Effect,
      myocardialPhEffect:s.leftHeartContractility.phEffect,
      leftHeartContractility:s.leftHeartContractility.contractility,
      sbpMmHg:s.leftHeartPump.sbpMmHg,
      strokeVolumeMl:s.strokeVolumeMl,
      cardiacOutputMlPerMin:s.cardiacOutputMlPerMin,
    },
    extrema:{
      maximumHeartRatePerMin:maxHr,
      minimumStrokeVolumeMl:minSv,
      minimumCardiacOutputMlPerMin:minCo,
      minimumLeftHeartContractility:minContractility,
      maximumCardiacSympatheticHz:maxCardiacSymps,
      maximumEpinephrinePgPerMl:maxEpi,
    },
  };
}

const stages=[];
stages.push(stage('baseline',600,BASE));
stages.push(stage('compensated-severe-hypoxia',600,{
  ...BASE,
  arterialPo2MmHg:30,
}));
stages.push(stage('early-acidemic-compensation',180,{
  ...BASE,
  arterialPo2MmHg:30,
  arterialPh:7.10,
  myocardialIntracellularPh:6.72,
}));
stages.push(stage('myocardial-decompensation',300,{
  ...BASE,
  arterialPo2MmHg:30,
  arterialPh:7.10,
  myocardialIntracellularPh:6.68,
}));
stages.push(stage('reoxygenation-with-persistent-myocardial-acidosis',300,{
  ...BASE,
  arterialPo2MmHg:94,
  arterialPh:7.44,
  myocardialIntracellularPh:6.68,
}));
stages.push(stage('full-recovery',900,BASE));

const comp=stages.find(x=>x.label==='compensated-severe-hypoxia');
const decomp=stages.find(x=>x.label==='myocardial-decompensation');

console.log(JSON.stringify({
  schema:'hummod-2013-compensation-decompensation-audit/v1',
  authority:'candidate-not-canonical',
  canonicalControlAuthority:false,
  physiologyChanged:false,
  regressionFixtureSizing:{
    sourceCardiacOutputMlPerMin:5000,
    leftHeartMassG:300,
    systemicArteryTotalVolumeMl:1000,
    note:
      'Synthetic regression fixture only; not asserted as HumMod default patient or clinical baseline.',
  },
  stages,
  summary:{
    compensatedHypoxiaTachycardic:comp.endpoint.heartRatePerMin>100,
    decompensationRetainsTachycardia:decomp.endpoint.heartRatePerMin>100,
    decompensationReducesContractility:
      decomp.endpoint.leftHeartContractility<
      comp.endpoint.leftHeartContractility,
    decompensationReducesStrokeVolume:
      decomp.endpoint.strokeVolumeMl<
      comp.endpoint.strokeVolumeMl,
    decompensationReducesCardiacOutput:
      decomp.endpoint.cardiacOutputMlPerMin<
      comp.endpoint.cardiacOutputMlPerMin,
  },
  interpretation:
    'Mechanism-composition audit only. Arterial gas drives the 2013 chemoreflex compensation branch; myocardial intracellular pH is an explicit source-owned upstream state and is not derived from arterial pH in this audit.',
},null,2));
