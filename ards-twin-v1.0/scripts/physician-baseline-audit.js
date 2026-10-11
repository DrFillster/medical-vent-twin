#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {
  LIVE_HUMMOD_REFERENCE_CASE_ID,
  createBerlinLiveHumModSession,
}=require('../src/clinical_twin_live_hummod_session.js');

function makeSession(fio2=0.60){
  return createBerlinLiveHumModSession({
    caseId:LIVE_HUMMOD_REFERENCE_CASE_ID,
    ventilation:{
      mode:'VC_AC', fio2, peep:8, rr:20,
      vtL:0.42, inspiratoryFlowLps:0.70, inspiratoryPauseSec:0.20,
    },
    initialRecruitmentState:{normal:1,recruitable:0.35,consolidated:0},
    dt:0.002,
    mechanicalWarmupSec:30,
    coupledEquilibrationSec:600,
  });
}

function row(s,label){
  const g=s.systemic?.gasExchange||{};
  const h=s.systemic?.hemodynamics||{};
  const d=s.systemic?.decompensation||{};
  const pc=s.systemic?.physicianComparison?.publishedModelInterim||{};
  return {
    label,timeSec:s.timeSec,
    heartRatePerMin:h.heartRatePerMin,
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
    globalDo2MlPerMin:g.convectiveOxygenDeliveryMlPerMin,
    globalOxygenDebtSurrogateMl:d.oxygenDebtMl,
    stage:d.stage,
  };
}

const cases=[];
for(const fio2 of [0.60,0.80,1.00]){
  const session=makeSession(fio2);
  let s=session.initialize();
  const rows=[row(s,'exposed-time-zero')];
  for(const target of [30,60,300]){
    const delta=target-s.timeSec;
    if(delta>0) s=session.runFor(delta);
    rows.push(row(s,'no-intervention-'+target+'s'));
  }
  cases.push({fio2,rows});
}
const out={
  schema:'physician-baseline-audit/v2',
  source:'v1.5 experimental aspiration reference patient',
  note:'Descriptive audit. The hidden 600-second pre-history advances Vent and systemic physiology together under unchanged starting settings; exposed patient time begins afterward.',
  cases,
};
const dir=path.resolve(__dirname,'../physician-audit-results');
fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(path.join(dir,'baseline-equilibrated.json'),JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out,null,2));
