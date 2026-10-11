#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {createUrsino1998ClosedLoopRuntime}=
  require('../src/ursino_1998_closed_loop_runtime.js');

const r=createUrsino1998ClosedLoopRuntime({dtSec:0.002});

function row(label){
  const s=r.snapshot();
  return {
    label,timeSec:s.timeSec,
    hr:s.hemodynamics.heartRatePerMin,
    psa:s.hemodynamics.systemicArterialPressureMmHg,
    ppa:s.hemodynamics.pulmonaryArteryPressureMmHg,
    pra:s.hemodynamics.rightAtrialPressureMmHg,
    pla:s.hemodynamics.leftAtrialPressureMmHg,
    lvOutflowMlPerSec:s.hemodynamics.leftVentricleOutflowMlPerSec,
    rvOutflowMlPerSec:s.hemodynamics.rightVentricleOutflowMlPerSec,
    emaxLv:s.hemodynamics.EmaxLvMmHgPerMl,
    emaxRv:s.hemodynamics.EmaxRvMmHgPerMl,
    rsp:s.hemodynamics.splanchnicResistanceMmHgSecPerMl,
    rep:s.hemodynamics.extrasplanchnicResistanceMmHgSecPerMl,
    vusv:s.hemodynamics.splanchnicVenousUnstressedVolumeMl,
    vuev:s.hemodynamics.extrasplanchnicVenousUnstressedVolumeMl,
    fCs:s.control.fCsSpikesPerSec,
    fEs:s.control.fEsSpikesPerSec,
    fEv:s.control.fEvSpikesPerSec,
    totalBloodVolumeMl:s.state.Vt,
  };
}

const rows=[row('seed')];
for(const sec of [5,15,30,60]){
  r.runFor(sec-(rows[rows.length-1].timeSec||0));
  rows.push(row('pre-hemorrhage-'+sec+'s'));
}
r.withdrawBloodMl(530);
rows.push(row('hemorrhage-10pct'));
const t0=r.snapshot().timeSec;
for(const delta of [5,20,40,80]){
  r.runFor(t0+delta-r.snapshot().timeSec);
  rows.push(row('post-hemorrhage-'+delta+'s'));
}

const out={
  schema:'ursino-1998-closed-loop-candidate/v1',
  authority:'candidate-not-canonical',
  note:'Numerical candidate for source reproduction. The 10% hemorrhage mirrors the primary paper challenge; no result is accepted until compared with the source figure/data.',
  rows,
};
const dir=path.resolve(__dirname,'../physician-audit-results');
fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(path.join(dir,'ursino-1998-closed-loop-challenge.json'),JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out,null,2));
