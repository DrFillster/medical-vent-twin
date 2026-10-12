#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {
  createUrsinoMagosso2000ExpandedHypoxiaClosedLoop,
}=require('../src/ursino_magosso_2000_expanded_hypoxia_closed_loop.js');

const DT=0.002;

function flows(s){
  const p=s.vascularState,e=s.vascularEffectors;
  return {
    autoregulated:
      (p.Psp-p.Pmv)/e.Rmp+
      (p.Psp-p.Pbv)/e.Rbp+
      (p.Psp-p.Phv)/e.Rhp,
    remaining:
      (p.Psp-p.Psv)/e.Rsp+
      (p.Psp-p.Pev)/e.Rep,
  };
}

function empty(){
  return {
    hr:0,map:0,co:0,vt:0,autoregulated:0,remaining:0,
    fAb:0,fAc:0,fAp:0,fSp:0,fSh:0,fV:0,
    Rsp:0,Rep:0,Vusv:0,Vuev:0,
  };
}

function add(sum,s){
  const f=flows(s),e=s.vascularEffectors,a=s.autonomic;
  sum.hr+=s.hemodynamics.heartRatePerMin;
  sum.map+=s.hemodynamics.systemicArterialPressureMmHg;
  sum.co+=s.hemodynamics.leftVentricleOutflowMlPerSec;
  sum.vt+=s.ventilation.activeTidalVolumeL;
  sum.autoregulated+=f.autoregulated;
  sum.remaining+=f.remaining;
  sum.fAb+=a.fAbSpikesPerSec;
  sum.fAc+=a.fAcSpikesPerSec;
  sum.fAp+=a.fApSpikesPerSec;
  sum.fSp+=a.fSpSpikesPerSec;
  sum.fSh+=a.fShSpikesPerSec;
  sum.fV+=a.fVSpikesPerSec;
  sum.Rsp+=e.Rsp; sum.Rep+=e.Rep;
  sum.Vusv+=e.Vusv; sum.Vuev+=e.Vuev;
}

function divide(sum,n){
  const out={};
  for(const [k,v] of Object.entries(sum)) out[k]=v/n;
  return out;
}

const r=createUrsinoMagosso2000ExpandedHypoxiaClosedLoop({
  dtSec:DT,
  pao2MmHg:95,
  paco2MmHg:40,
  ventilationMode:'ursino-magosso-2000-spontaneous-validation',
});

r.runFor(120);

const baselineSum=empty();
const baselineN=Math.round(5/DT);
for(let i=0;i<baselineN;i++){
  add(baselineSum,r.snapshot());
  r.step();
}
const baseline=divide(baselineSum,baselineN);

const seconds=[];
const stepsPerSec=Math.round(1/DT);
for(let sec=0;sec<60;sec++){
  const sum=empty();
  let pao2Sum=0;
  for(let i=0;i<stepsPerSec;i++){
    const elapsed=sec+i*DT;
    const pao2=elapsed<10
      ?95+(28-95)*(elapsed/10)
      :28;
    r.setEnvironment({pao2MmHg:pao2,paco2MmHg:40});
    const s=r.snapshot();
    add(sum,s);
    pao2Sum+=pao2;
    r.step();
  }
  seconds.push({
    startSec:sec,
    endSec:sec+1,
    pao2MmHg:pao2Sum/stepsPerSec,
    ...divide(sum,stepsPerSec),
  });
}

function pct(v,b){return 100*(v-b)/b;}
const normalized=seconds.map(row=>({
  ...row,
  pct:{
    hr:pct(row.hr,baseline.hr),
    map:pct(row.map,baseline.map),
    co:pct(row.co,baseline.co),
    autoregulated:pct(row.autoregulated,baseline.autoregulated),
    remaining:pct(row.remaining,baseline.remaining),
  },
}));

const out={
  schema:'ursino-magosso-2000-fig11-phase-trace/v1',
  authority:'source-reproduction-diagnostic-only',
  source:{
    doi:'10.1152/ajpheart.2000.279.1.H149',
    figure:'Fig. 11',
  },
  method:{
    dtSec:DT,
    settleSec:120,
    baselineMeanSec:5,
    traceBinSec:1,
    protocol:'PaO2 95 to 28 mmHg linearly over 10 s, then held at 28; PaCO2 40; source spontaneous VT.',
  },
  baseline,
  seconds:normalized,
};

const dir=path.resolve(__dirname,'../physician-audit-results');
fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(
  path.join(dir,'ursino-magosso-2000-fig11-phase-trace.json'),
  JSON.stringify(out,null,2)+'\n'
);
console.log(JSON.stringify(out,null,2));
