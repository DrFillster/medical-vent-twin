#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {
  createUrsinoMagosso2000ExpandedHypoxiaClosedLoop,
}=require('../src/ursino_magosso_2000_expanded_hypoxia_closed_loop.js');

const DT=0.002;

function empty(){
  return {
    hr:0,map:0,co:0,vt:0,
    fAb:0,fAc:0,fAp:0,thetaSp:0,thetaSh:0,fSp:0,fSh:0,fV:0,
    Rsp:0,Rep:0,Rmp:0,Rbp:0,Rhp:0,
    Vusv:0,Vuev:0,Vumv:0,
    autoregulated:0,remaining:0,
  };
}

function add(sum,s){
  const p=s.vascularState,e=s.vascularEffectors,a=s.autonomic;
  const autoregulated=
    (p.Psp-p.Pmv)/e.Rmp+
    (p.Psp-p.Pbv)/e.Rbp+
    (p.Psp-p.Phv)/e.Rhp;
  const remaining=
    (p.Psp-p.Psv)/e.Rsp+
    (p.Psp-p.Pev)/e.Rep;

  sum.hr+=s.hemodynamics.heartRatePerMin;
  sum.map+=s.hemodynamics.systemicArterialPressureMmHg;
  sum.co+=s.hemodynamics.leftVentricleOutflowMlPerSec;
  sum.vt+=s.ventilation.activeTidalVolumeL;
  sum.fAb+=a.fAbSpikesPerSec;
  sum.fAc+=a.fAcSpikesPerSec;
  sum.fAp+=a.fApSpikesPerSec;
  sum.thetaSp+=a.thetaSpSpikesPerSec;
  sum.thetaSh+=a.thetaShSpikesPerSec;
  sum.fSp+=a.fSpSpikesPerSec;
  sum.fSh+=a.fShSpikesPerSec;
  sum.fV+=a.fVSpikesPerSec;
  sum.Rsp+=e.Rsp;
  sum.Rep+=e.Rep;
  sum.Rmp+=e.Rmp;
  sum.Rbp+=e.Rbp;
  sum.Rhp+=e.Rhp;
  sum.Vusv+=e.Vusv;
  sum.Vuev+=e.Vuev;
  sum.Vumv+=e.Vumv;
  sum.autoregulated+=autoregulated;
  sum.remaining+=remaining;
}

function divide(sum,n){
  const out={};
  for(const [k,v] of Object.entries(sum)) out[k]=v/n;
  return out;
}

function pct(row,baseline){
  const out={};
  for(const key of [
    'hr','map','co','vt','fAb','fAc','fAp','thetaSp','thetaSh',
    'fSp','fSh','fV','Rsp','Rep','Rmp','Rbp','Rhp',
    'Vusv','Vuev','Vumv','autoregulated','remaining',
  ]){
    const b=baseline[key];
    out[key]=Math.abs(b)>1e-12 ? 100*(row[key]-b)/b : null;
  }
  return out;
}

const r=createUrsinoMagosso2000ExpandedHypoxiaClosedLoop({
  dtSec:DT,
  pao2MmHg:95,
  paco2MmHg:40,
  ventilationMode:'ursino-magosso-2000-spontaneous-validation',
});

r.runFor(120);

const baseSum=empty();
const baseN=Math.round(10/DT);
for(let i=0;i<baseN;i++){
  add(baseSum,r.snapshot());
  r.step();
}
const baseline=divide(baseSum,baseN);

const bins=[];
const stepsPerSec=Math.round(1/DT);
for(let sec=0;sec<20;sec++){
  const sum=empty();
  let pao2Sum=0;
  for(let i=0;i<stepsPerSec;i++){
    const elapsed=sec+i*DT;
    const pao2=elapsed<10 ? 95+(28-95)*(elapsed/10) : 28;
    r.setEnvironment({pao2MmHg:pao2,paco2MmHg:40});
    const s=r.snapshot();
    add(sum,s);
    pao2Sum+=pao2;
    r.step();
  }
  const mean=divide(sum,stepsPerSec);
  bins.push({
    startSec:sec,
    endSec:sec+1,
    pao2MmHg:pao2Sum/stepsPerSec,
    ...mean,
    pct:pct(mean,baseline),
  });
}

const out={
  schema:'ursino-magosso-2000-fig11-mechanism-trace/v1',
  authority:'diagnostic-source-reproduction-only',
  source:{
    doi:'10.1152/ajpheart.2000.279.1.H149',
    figure:'Fig. 11',
  },
  method:{
    dtSec:DT,
    settleSec:120,
    baselineMeanSec:10,
    traceBinSec:1,
    protocol:'PaO2 95 to 28 mmHg linearly over 10 s then held; PaCO2 40; source spontaneous VT.',
  },
  baseline,
  seconds:bins,
};

const dir=path.resolve(__dirname,'../physician-audit-results');
fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(
  path.join(dir,'ursino-magosso-2000-fig11-mechanism-trace.json'),
  JSON.stringify(out,null,2)+'\n'
);
console.log(JSON.stringify(out,null,2));
