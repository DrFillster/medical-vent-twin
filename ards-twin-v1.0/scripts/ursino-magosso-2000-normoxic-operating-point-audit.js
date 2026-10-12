#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');

const {
  createUrsinoMagosso2000ExpandedHypoxiaClosedLoop,
}=require('../src/ursino_magosso_2000_expanded_hypoxia_closed_loop.js');

const DT=0.002;

function meanWindow(r,seconds=10){
  const n=Math.round(seconds/DT);
  const keys=[
    'hr','map','co','vt',
    'fAb','fAc','fAp','thetaSp','thetaSh','fSp','fSh','fV',
    'Rsp','Rep','Rmp','Vusv','Vuev','Vumv',
    'brainFlow','heartFlow','muscleFlow','splanchnicFlow','extraFlow',
    'conservationErrorMl',
  ];
  const sum=Object.fromEntries(keys.map(k=>[k,0]));

  for(let i=0;i<n;i++){
    const s=r.snapshot();
    const p=s.vascularState;
    const e=s.vascularEffectors;
    const a=s.autonomic;
    sum.hr+=s.hemodynamics.heartRatePerMin;
    sum.map+=s.hemodynamics.systemicArterialPressureMmHg;
    sum.co+=s.hemodynamics.leftVentricleOutflowMlPerSec;
    sum.vt+=s.ventilation.activeTidalVolumeL;
    if(a){
      sum.fAb+=a.fAbSpikesPerSec;
      sum.fAc+=a.fAcSpikesPerSec;
      sum.fAp+=a.fApSpikesPerSec;
      sum.thetaSp+=a.thetaSpSpikesPerSec;
      sum.thetaSh+=a.thetaShSpikesPerSec;
      sum.fSp+=a.fSpSpikesPerSec;
      sum.fSh+=a.fShSpikesPerSec;
      sum.fV+=a.fVSpikesPerSec;
    }
    sum.Rsp+=e.Rsp;
    sum.Rep+=e.Rep;
    sum.Rmp+=e.Rmp;
    sum.Vusv+=e.Vusv;
    sum.Vuev+=e.Vuev;
    sum.Vumv+=e.Vumv;
    sum.brainFlow+=(p.Psp-p.Pbv)/e.Rbp;
    sum.heartFlow+=(p.Psp-p.Phv)/e.Rhp;
    sum.muscleFlow+=(p.Psp-p.Pmv)/e.Rmp;
    sum.splanchnicFlow+=(p.Psp-p.Psv)/e.Rsp;
    sum.extraFlow+=(p.Psp-p.Pev)/e.Rep;
    sum.conservationErrorMl+=s.conservation.errorMl;
    r.step();
  }
  for(const k of keys) sum[k]/=n;
  return sum;
}

const r=createUrsinoMagosso2000ExpandedHypoxiaClosedLoop({
  dtSec:DT,
  pao2MmHg:95,
  paco2MmHg:40,
  ventilationMode:'ursino-magosso-2000-spontaneous-validation',
});

const checkpoints=[];
let elapsed=0;
for(const target of [120,240,360,600]){
  r.runFor(target-elapsed);
  elapsed=target;
  checkpoints.push({
    settleSec:target,
    mean10s:meanWindow(r,10),
  });
  elapsed+=10;
}

const out={
  schema:'ursino-magosso-2000-normoxic-operating-point-audit/v1',
  authority:'diagnostic-source-reproduction-only',
  environment:{pao2MmHg:95,paco2MmHg:40},
  checkpoints,
};
const dir=path.resolve(__dirname,'../physician-audit-results');
fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(
  path.join(dir,'ursino-magosso-2000-normoxic-operating-point-audit.json'),
  JSON.stringify(out,null,2)+'\n'
);
console.log(JSON.stringify(out,null,2));
