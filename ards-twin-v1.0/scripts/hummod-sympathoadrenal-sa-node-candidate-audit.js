#!/usr/bin/env node
'use strict';

const {
  createHumModSympathoadrenalSaNodeCandidate,
}=require('../src/hummod_sympathoadrenal_sa_node_candidate.js');

const DT=0.1;
const ECFV_ML=15000; // HumMod catechol documentation reference distribution volume.

function mean(rows,key){
  const vals=rows.map(x=>x[key]).filter(Number.isFinite);
  return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null;
}

function runStage(c,{label,seconds,carotidPressureMmHg,brainFuelFractUseDelay}){
  const rows=[];
  const n=Math.round(seconds/DT);
  for(let i=0;i<n;i++){
    const s=c.step({
      dtSec:DT,
      carotidPressureMmHg,
      averageAtrialTmpMmHg:6,
      brainFuelFractUseDelay,
      brainFunctionEffect:1,
      sympsChemoEffect:1,
      otherTissueFunctionEffect:1,
    });
    rows.push({
      heartRatePerMin:s.heartRatePerMin,
      sympsCnsHz:s.sympsCnsHz,
      vagusHz:s.vagusHz,
      epiPgPerMl:s.catecholamines.epiPgPerMl,
      nePgPerMl:s.catecholamines.nePgPerMl,
      betaEffect:s.catecholamines.betaEffect,
      saBetaActivity:s.saBetaActivity,
    });
  }
  const end=c.snapshot();
  return {
    label,
    seconds,
    sourceInputs:{
      carotidPressureMmHg,
      brainFuelFractUseDelay,
    },
    meanLast10Sec:{
      heartRatePerMin:mean(rows.slice(-Math.round(10/DT)),'heartRatePerMin'),
      sympsCnsHz:mean(rows.slice(-Math.round(10/DT)),'sympsCnsHz'),
      vagusHz:mean(rows.slice(-Math.round(10/DT)),'vagusHz'),
      epiPgPerMl:mean(rows.slice(-Math.round(10/DT)),'epiPgPerMl'),
      nePgPerMl:mean(rows.slice(-Math.round(10/DT)),'nePgPerMl'),
      betaEffect:mean(rows.slice(-Math.round(10/DT)),'betaEffect'),
      saBetaActivity:mean(rows.slice(-Math.round(10/DT)),'saBetaActivity'),
    },
    endpoint:{
      heartRatePerMin:end.heartRatePerMin,
      sympsCnsHz:end.sympsCnsHz,
      vagusHz:end.vagusHz,
      epiPgPerMl:end.catecholamines.epiPgPerMl,
      nePgPerMl:end.catecholamines.nePgPerMl,
      betaEffect:end.catecholamines.betaEffect,
      saBetaActivity:end.saBetaActivity,
    },
    exceeded100:rows.some(x=>x.heartRatePerMin>100),
    maximumHeartRatePerMin:Math.max(...rows.map(x=>x.heartRatePerMin)),
  };
}

const c=createHumModSympathoadrenalSaNodeCandidate({
  ecfvMl:ECFV_ML,
  initialCarotidPressureMmHg:97,
  initialAverageAtrialTmpMmHg:6,
});

const stages=[];
stages.push(runStage(c,{
  label:'baseline',
  seconds:120,
  carotidPressureMmHg:97,
  brainFuelFractUseDelay:1,
}));
stages.push(runStage(c,{
  label:'baroreceptor-unloading',
  seconds:120,
  carotidPressureMmHg:60,
  brainFuelFractUseDelay:1,
}));
stages.push(runStage(c,{
  label:'recovery-after-pressure',
  seconds:180,
  carotidPressureMmHg:97,
  brainFuelFractUseDelay:1,
}));
stages.push(runStage(c,{
  label:'brain-fuel-stress',
  seconds:120,
  carotidPressureMmHg:97,
  brainFuelFractUseDelay:0.6,
}));
stages.push(runStage(c,{
  label:'combined-pressure-and-brain-fuel-stress',
  seconds:120,
  carotidPressureMmHg:60,
  brainFuelFractUseDelay:0.6,
}));
stages.push(runStage(c,{
  label:'final-recovery',
  seconds:240,
  carotidPressureMmHg:97,
  brainFuelFractUseDelay:1,
}));

const out={
  schema:'hummod-sympathoadrenal-sa-node-physician-candidate-audit/v1',
  authority:'candidate-not-canonical',
  canonicalControlAuthority:false,
  source:{
    family:'HumMod source-aligned acute sympathoadrenal / SA-node chain',
    reproducibilityRevision:'8dab57e05631f779bf5020fe0dd51874d8ae98c1',
  },
  method:{
    dtSec:DT,
    ecfvMl:ECFV_ML,
    ecfvBasis:
      'HumMod catechol documentation reference volume of distribution; candidate constructor otherwise requires explicit ECFV.',
    note:
      'Stress coordinates are native HumMod controller inputs. No arterial gas -> Brain-Fuel or arterial gas -> SympsCNS mapping is asserted here.',
  },
  stages,
  summary:{
    anySourceNativeStressExceeded100:
      stages.filter(x=>x.label!=='baseline'&&!x.label.includes('recovery'))
        .some(x=>x.exceeded100),
    maximumHeartRatePerMin:
      Math.max(...stages.map(x=>x.maximumHeartRatePerMin)),
  },
};

console.log(JSON.stringify(out,null,2));
