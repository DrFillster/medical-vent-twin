#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {
  createGasCardiovascularClosedLoopShadow,
}=require('../src/ursino_magosso_gas_closed_loop_shadow.js');

const DT=0.002;
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

function row(label){
  const s=r.snapshot();
  const a=s.gasAutonomic;
  return {
    label,
    timeSec:s.timeSec,
    pao2MmHg:s.environment.pao2MmHg,
    paco2MmHg:s.environment.paco2MmHg,
    tidalVolumeL:s.environment.tidalVolumeL,
    hrPerMin:s.hemodynamics.heartRatePerMin,
    sapMmHg:s.hemodynamics.systemicArterialPressureMmHg,
    ppaMmHg:s.hemodynamics.pulmonaryArteryPressureMmHg,
    praMmHg:s.hemodynamics.rightAtrialPressureMmHg,
    plaMmHg:s.hemodynamics.leftAtrialPressureMmHg,
    lvOutflowMlPerSec:s.hemodynamics.leftVentricleOutflowMlPerSec,
    peripheralResistanceMmHgSecPerMl:peripheralResistance(s),
    emaxLvMmHgPerMl:s.hemodynamics.EmaxLvMmHgPerMl,
    emaxRvMmHgPerMl:s.hemodynamics.EmaxRvMmHgPerMl,
    vusvMl:s.hemodynamics.splanchnicVenousUnstressedVolumeMl,
    vuevMl:s.hemodynamics.extrasplanchnicVenousUnstressedVolumeMl,
    fAbSpikesPerSec:a?.afferents?.fAbSpikesPerSec ?? null,
    fAcSpikesPerSec:a?.afferents?.fAcSpikesPerSec ?? null,
    fApSpikesPerSec:a?.afferents?.fApSpikesPerSec ?? null,
    fSpSpikesPerSec:a?.autonomic?.fSpSpikesPerSec ?? null,
    fSvSpikesPerSec:a?.autonomic?.fSvSpikesPerSec ?? null,
    fShSpikesPerSec:a?.autonomic?.fShSpikesPerSec ?? null,
    fVSpikesPerSec:a?.autonomic?.fVSpikesPerSec ?? null,
    dVuevDtMlPerSec:a?.effectorRate?.Vuev ?? null,
    authority:s.authority,
  };
}

function stage(label,seconds,environment=null){
  if(environment) r.setEnvironment(environment);
  r.runFor(seconds);
  return row(label);
}

// Long enough to clear the 20-30 s autonomic time constants and 20 s venous
// effector time constant before the first observation. This is a numerical
// equilibration interval, not a physiologic calibration.
const rows=[];
rows.push(stage('normoxic-baseline',180));

// Controlled-ventilation challenges: tidal volume is held fixed so respiratory
// drive does not become an implicit second controller.
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
  schema:'ursino-magosso-gas-cardiovascular-closed-loop/v1',
  authority:'candidate-not-canonical',
  controlAuthority:false,
  protocol:{
    dtSec:DT,
    tidalVolumeL:0.5,
    note:'Controlled-ventilation gas challenge. No parameter fitting, target matching, or HumMod reconciliation is performed.',
  },
  rows,
  interpretationGate:{
    status:'UNASSESSED',
    required:[
      'all states finite and mechanically stable',
      'direction/timing checked against source perturbations',
      'healthy-human validation checked independently',
      'step-size convergence repeated',
      'recovery assessed without residual numerical drift',
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
