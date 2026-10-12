#!/usr/bin/env node
'use strict';

const {
  createHumMod2013ChemoreflexSaNodeCandidate,
}=require('../src/hummod_2013_chemoreflex_sa_node_candidate.js');

const DT=0.1;
const ECFV_ML=15000;

function runStage(c,{label,seconds,arterialPo2MmHg,arterialPh}){
  const n=Math.round(seconds/DT);
  let maxHr=-Infinity,maxChemo=-Infinity,maxCns=-Infinity,maxEpi=-Infinity,maxNe=-Infinity;
  let firstOver100Sec=null;
  const start=c.snapshot().timeSec||0;
  for(let i=0;i<n;i++){
    const s=c.step({dtSec:DT,arterialPo2MmHg,arterialPh});
    if(s.heartRatePerMin>maxHr) maxHr=s.heartRatePerMin;
    if(s.chemoreceptor.firingRate>maxChemo) maxChemo=s.chemoreceptor.firingRate;
    if(s.chemoreceptorsCns.effect>maxCns) maxCns=s.chemoreceptorsCns.effect;
    if(s.catecholamines.epiPgPerMl>maxEpi) maxEpi=s.catecholamines.epiPgPerMl;
    if(s.catecholamines.nePgPerMl>maxNe) maxNe=s.catecholamines.nePgPerMl;
    if(firstOver100Sec==null&&s.heartRatePerMin>100){
      firstOver100Sec=s.timeSec-start;
    }
  }
  const s=c.snapshot();
  return {
    label,seconds,arterialPo2MmHg,arterialPh,
    endpoint:{
      heartRatePerMin:s.heartRatePerMin,
      chemoreceptorFiringRate:s.chemoreceptor.firingRate,
      chemoCnsEffect:s.chemoreceptorsCns.effect,
      onsetDelay:s.chemoreceptorsCns.onsetDelay,
      adaptationDelay:s.chemoreceptorsCns.adaptationDelay,
      cardiacSympatheticHz:s.sympathetic.cardiacHz,
      adrenalSympatheticHz:s.sympathetic.adrenalHz,
      generalSympatheticHz:s.sympathetic.generalHz,
      vagusHz:s.saNode.vagusHz,
      betaActivity:s.saNode.betaActivity,
      epiPgPerMl:s.catecholamines.epiPgPerMl,
      nePgPerMl:s.catecholamines.nePgPerMl,
    },
    extrema:{
      maximumHeartRatePerMin:maxHr,
      maximumChemoreceptorFiringRate:maxChemo,
      maximumChemoCnsEffect:maxCns,
      maximumEpiPgPerMl:maxEpi,
      maximumNePgPerMl:maxNe,
      firstOver100Sec,
    },
    exceeded100:maxHr>100,
  };
}

const c=createHumMod2013ChemoreflexSaNodeCandidate({
  ecfvMl:ECFV_ML,
  initialArterialPh:7.44,
});

const stages=[];
stages.push(runStage(c,{
  label:'baseline',
  seconds:600,
  arterialPo2MmHg:94,
  arterialPh:7.44,
}));
stages.push(runStage(c,{
  label:'isolated-severe-hypoxia',
  seconds:600,
  arterialPo2MmHg:30,
  arterialPh:7.44,
}));
stages.push(runStage(c,{
  label:'recovery-1',
  seconds:600,
  arterialPo2MmHg:94,
  arterialPh:7.44,
}));
stages.push(runStage(c,{
  label:'isolated-severe-acidemia',
  seconds:600,
  arterialPo2MmHg:94,
  arterialPh:7.10,
}));
stages.push(runStage(c,{
  label:'recovery-2',
  seconds:600,
  arterialPo2MmHg:94,
  arterialPh:7.44,
}));
stages.push(runStage(c,{
  label:'combined-severe-hypoxia-acidemia',
  seconds:600,
  arterialPo2MmHg:30,
  arterialPh:7.10,
}));
stages.push(runStage(c,{
  label:'final-recovery',
  seconds:900,
  arterialPo2MmHg:94,
  arterialPh:7.44,
}));

const stressStages=stages.filter(x=>x.label.includes('severe'));
const out={
  schema:'hummod-2013-chemoreflex-sa-node-qualification/v1',
  authority:'candidate-not-canonical',
  canonicalControlAuthority:false,
  physiologyChanged:false,
  source:{
    repository:'nysuloem/HumMod-UTSC-CPG',
    revision:'51d369eb75669e150ef7c61e3ba8bcb1e068aecf',
    generation:'HumMod 2012/2013',
  },
  protocol:{
    dtSec:DT,
    ecfvMl:ECFV_ML,
    stageDurationSec:600,
    note:
      'Isolated chemoreflex candidate. Other sympathetic reflex multipliers are held at source-neutral values; additive stress pathways are zero. HR >100 is a physician macro-validation criterion, not a HumMod source threshold.',
  },
  stages,
  summary:{
    anyStressExceeded100:stressStages.some(x=>x.exceeded100),
    maximumStressHeartRatePerMin:
      Math.max(...stressStages.map(x=>x.extrema.maximumHeartRatePerMin)),
    firstStressOver100:
      stressStages.find(x=>x.exceeded100)?.label||null,
  },
};

console.log(JSON.stringify(out,null,2));
