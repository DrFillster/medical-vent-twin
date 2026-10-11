#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {
  LIVE_HUMMOD_REFERENCE_CASE_ID,
  createBerlinLiveHumModSession,
}=require('../src/clinical_twin_live_hummod_session.js');

const session=createBerlinLiveHumModSession({
  caseId:LIVE_HUMMOD_REFERENCE_CASE_ID,
  ventilation:{
    mode:'VC_AC', fio2:0.60, peep:8, rr:20,
    vtL:0.42, inspiratoryFlowLps:0.70, inspiratoryPauseSec:0.20,
  },
  initialRecruitmentState:{normal:1,recruitable:0.35,consolidated:0},
  dt:0.002,
  mechanicalWarmupSec:30,
});

function row(s,label){
  const g=s.systemic?.gasExchange||{};
  const h=s.systemic?.hemodynamics||{};
  const d=s.systemic?.decompensation||{};
  const a=s.systemic?.autonomicShadow||{};
  const pc=s.systemic?.physicianComparison?.publishedModelInterim||{};
  return {
    label,
    timeSec:s.timeSec,
    heartRatePerMin:h.heartRatePerMin,
    sourceSaNodeHeartRatePerMin:h.sourceSaNodeHeartRatePerMin,
    publishedModelHeartRatePerMin:pc.heartRatePerMin,
    meanArterialPressureMmHg:h.meanArterialPressureMmHg,
    cardiacOutputLPerMin:Number.isFinite(h.cardiacOutputMlPerMin)?h.cardiacOutputMlPerMin/1000:null,
    strokeVolumeMl:h.strokeVolumeMl,
    systemicVascularResistanceMmHgMinPerL:h.systemicVascularResistanceMmHgMinPerL,
    pulmonaryVascularResistanceMmHgMinPerL:h.pulmonaryVascularResistanceMmHgMinPerL,
    rightAtrialPressureMmHg:h.rightAtrialPressureMmHg,
    pulmonaryArteryPressureMmHg:h.pulmonaryArteryPressureMmHg,
    sao2Fraction:g.sao2Fraction,
    pao2MmHg:g.pao2MmHg,
    paco2MmHg:g.paco2MmHg,
    pH:g.pH,
    svo2Fraction:g.svo2Fraction,
    brainTissuePo2MmHg:h.brainTissuePo2MmHg,
    brainInsultPo2Effect:h.brainFunctionEffect,
    sympatheticFiringHz:h.sympatheticFiringHz,
    vagalFiringHz:h.vagalFiringHz,
    ursinoCardiacSympatheticSpikesPerSec:a.fShSpikesPerSec,
    ursinoCardiacVagalSpikesPerSec:a.fVSpikesPerSec,
    globalDo2MlPerMin:g.convectiveOxygenDeliveryMlPerMin,
    globalOxygenDebtSurrogateMl:d.oxygenDebtMl,
    stage:d.stage,
  };
}

const rows=[];
let s=session.initialize();
rows.push(row(s,'initialize'));
for(const target of [30,60,120,300,600]){
  const delta=target-s.timeSec;
  if(delta>0) s=session.runFor(delta);
  rows.push(row(s,'baseline-'+target+'s'));
}
const out={
  schema:'physician-baseline-audit/v1',
  source:'v1.5 reference patient; no intervention',
  note:'Descriptive audit only. No physiologic acceptance thresholds are applied.',
  rows,
};
const dir=path.resolve(__dirname,'../physician-audit-results');
fs.mkdirSync(dir,{recursive:true});
const file=path.join(dir,'baseline-10min.json');
fs.writeFileSync(file,JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out,null,2));
