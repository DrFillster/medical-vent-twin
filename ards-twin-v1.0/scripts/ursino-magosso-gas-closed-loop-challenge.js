#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {
  createGasCardiovascularClosedLoopShadow,
}=require('../src/ursino_magosso_gas_closed_loop_shadow.js');

const DT=0.002;
const MEAN_TRACE_SEC=20;

const r=createGasCardiovascularClosedLoopShadow({
  dtSec:DT,
  pao2MmHg:100,
  paco2MmHg:40,
  tidalVolumeL:0.5,
});

function peripheralResistance(s){
  const a=s.hemodynamics.splanchnicResistanceMmHgSecPerMl;
  const b=s.hemodynamics.extrasplanchnicResistanceMmHgSecPerMl;
  return 1/(1/a+1/b);
}

function sample(){
  const s=r.snapshot();
  const a=s.gasAutonomic;
  if(!a) throw new Error('gas autonomic state not initialized');
  return {
    hrPerMin:s.hemodynamics.heartRatePerMin,
    sapMmHg:s.hemodynamics.systemicArterialPressureMmHg,
    ppaMmHg:s.hemodynamics.pulmonaryArteryPressureMmHg,
    praMmHg:s.hemodynamics.rightAtrialPressureMmHg,
    plaMmHg:s.hemodynamics.leftAtrialPressureMmHg,
    cardiacOutputMlPerSec:s.hemodynamics.leftVentricleOutflowMlPerSec,
    peripheralResistanceMmHgSecPerMl:peripheralResistance(s),
    emaxLvMmHgPerMl:s.hemodynamics.EmaxLvMmHgPerMl,
    emaxRvMmHgPerMl:s.hemodynamics.EmaxRvMmHgPerMl,
    vusvMl:s.hemodynamics.splanchnicVenousUnstressedVolumeMl,
    vuevMl:s.hemodynamics.extrasplanchnicVenousUnstressedVolumeMl,
    fAbSpikesPerSec:a.afferents.fAbSpikesPerSec,
    fAcSpikesPerSec:a.afferents.fAcSpikesPerSec,
    fApSpikesPerSec:a.afferents.fApSpikesPerSec,
    fSpSpikesPerSec:a.autonomic.fSpSpikesPerSec,
    fSvSpikesPerSec:a.autonomic.fSvSpikesPerSec,
    fShSpikesPerSec:a.autonomic.fShSpikesPerSec,
    fVSpikesPerSec:a.autonomic.fVSpikesPerSec,
    dVuevDtMlPerSec:a.effectorRate.Vuev,
  };
}

function advanceToBeatBoundary(){
  let prior=r.snapshot().plantState.phase;
  for(let i=0;i<5000;i++){
    r.step();
    const current=r.snapshot().plantState.phase;
    if(current<prior) return;
    prior=current;
  }
  throw new Error('failed to find ventricular cycle boundary');
}

function meanOverIntegerHeartPeriods(minTraceSec=MEAN_TRACE_SEC){
  advanceToBeatBoundary();

  const startTimeSec=r.snapshot().timeSec;
  let previous=sample();
  let previousPhase=r.snapshot().plantState.phase;
  const integrals={};
  let beats=0;

  for(;;){
    r.step();
    const currentSnapshot=r.snapshot();
    const current=sample();

    for(const key of Object.keys(previous)){
      integrals[key]=(integrals[key]||0)+
        0.5*(previous[key]+current[key])*DT;
    }

    const wrapped=currentSnapshot.plantState.phase<previousPhase;
    if(wrapped) beats+=1;

    const elapsedSec=currentSnapshot.timeSec-startTimeSec;
    if(elapsedSec>=minTraceSec&&wrapped){
      const mean={};
      for(const [key,value] of Object.entries(integrals)){
        mean[key]=value/elapsedSec;
      }
      return {
        ...mean,
        cardiacOutputLMin:mean.cardiacOutputMlPerSec*0.06,
        traceSec:elapsedSec,
        beats,
        startTimeSec,
        endTimeSec:currentSnapshot.timeSec,
      };
    }

    previous=current;
    previousPhase=currentSnapshot.plantState.phase;
  }
}

function stage(label,totalStageSec,environment=null){
  if(environment) r.setEnvironment(environment);
  if(totalStageSec<=MEAN_TRACE_SEC){
    throw new Error('stage must exceed mean trace duration');
  }

  const stageStartSec=r.snapshot().timeSec;
  r.runFor(totalStageSec-MEAN_TRACE_SEC);
  const mean=meanOverIntegerHeartPeriods(MEAN_TRACE_SEC);
  const s=r.snapshot();

  return {
    label,
    stageStartSec,
    stageEndSec:s.timeSec,
    requestedStageSec:totalStageSec,
    pao2MmHg:s.environment.pao2MmHg,
    paco2MmHg:s.environment.paco2MmHg,
    tidalVolumeL:s.environment.tidalVolumeL,
    ...mean,
    authority:s.authority,
  };
}

const rows=[];

// Numerical equilibration interval only; no physiologic target is fitted.
rows.push(stage('normoxic-baseline',180));

/*
 * Controlled-ventilation challenges:
 * tidal volume is held fixed. This intentionally tests the source condition
 * in which ventilatory/lung-stretch compensation is not allowed to rise.
 */
rows.push(stage('isocapnic-hypoxia',120,{
  pao2MmHg:50,
  paco2MmHg:40,
  tidalVolumeL:0.5,
}));

rows.push(stage('recovery-after-hypoxia',180,{
  pao2MmHg:100,
  paco2MmHg:40,
  tidalVolumeL:0.5,
}));

rows.push(stage('mild-hypercapnia',120,{
  pao2MmHg:100,
  paco2MmHg:45,
  tidalVolumeL:0.5,
}));

rows.push(stage('recovery-after-mild-hypercapnia',180,{
  pao2MmHg:100,
  paco2MmHg:40,
  tidalVolumeL:0.5,
}));

rows.push(stage('combined-hypoxic-hypercapnia',120,{
  pao2MmHg:50,
  paco2MmHg:60,
  tidalVolumeL:0.5,
}));

rows.push(stage('final-recovery',240,{
  pao2MmHg:100,
  paco2MmHg:40,
  tidalVolumeL:0.5,
}));

const out={
  schema:'ursino-magosso-gas-cardiovascular-closed-loop/v2',
  authority:'candidate-not-canonical',
  controlAuthority:false,
  protocol:{
    dtSec:DT,
    tidalVolumeL:0.5,
    meanTraceMinimumSec:MEAN_TRACE_SEC,
    meanMethod:'trapezoidal time mean over >=20 s ending on an integer ventricular cycle',
    note:'Controlled-ventilation gas challenge. No parameter fitting, target matching, or HumMod reconciliation is performed.',
  },
  rows,
  interpretationGate:{
    status:'UNASSESSED',
    required:[
      'all mean states finite and mechanically stable',
      'direction/timing checked against source controlled-ventilation perturbations',
      'spontaneous-breathing validation run separately after respiratory-drive coupling exists',
      'healthy-human validation matched to protocol rather than used as calibration',
      'step-size convergence repeated',
      'recovery assessed for residual drift',
    ],
  },
};

const dir=path.resolve(__dirname,'../physician-audit-results');
fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(
  path.join(dir,'ursino-magosso-gas-closed-loop.json'),
  JSON.stringify(out,null,2)+'\n'
);
console.log(JSON.stringify(out,null,2));
