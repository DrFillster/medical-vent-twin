#!/usr/bin/env node
'use strict';

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

function meanSecond(r){
  const n=Math.round(1/DT);
  const x={hr:0,map:0,co:0,vt:0,autoregulated:0,remaining:0,fAb:0,fSp:0,fSh:0,fV:0};
  for(let i=0;i<n;i++){
    const s=r.snapshot();
    const f=flows(s);
    x.hr+=s.hemodynamics.heartRatePerMin;
    x.map+=s.hemodynamics.systemicArterialPressureMmHg;
    x.co+=s.hemodynamics.leftVentricleOutflowMlPerSec;
    x.vt+=s.ventilation.activeTidalVolumeL;
    x.autoregulated+=f.autoregulated;
    x.remaining+=f.remaining;
    if(s.autonomic){
      x.fAb+=s.autonomic.fAbSpikesPerSec;
      x.fSp+=s.autonomic.fSpSpikesPerSec;
      x.fSh+=s.autonomic.fShSpikesPerSec;
      x.fV+=s.autonomic.fVSpikesPerSec;
    }
    r.step();
  }
  for(const k of Object.keys(x)) x[k]/=n;
  return x;
}

const r=createUrsinoMagosso2000ExpandedHypoxiaClosedLoop({
  dtSec:DT,
  pao2MmHg:95,
  paco2MmHg:40,
  ventilationMode:'ursino-magosso-2000-spontaneous-validation',
});
r.runFor(120);

const baseline=meanSecond(r);
const bins=[];

for(let second=0;second<20;second++){
  // Ramp 95 -> 28 mmHg during first 10 s, then hold.
  const startPaO2=second<10
    ?95+(28-95)*(second/10)
    :28;
  const endPaO2=second+1<=10
    ?95+(28-95)*((second+1)/10)
    :28;

  const n=Math.round(1/DT);
  const sum={hr:0,map:0,co:0,vt:0,autoregulated:0,remaining:0,fAb:0,fSp:0,fSh:0,fV:0};
  for(let i=0;i<n;i++){
    const frac=i/n;
    const pao2=startPaO2+(endPaO2-startPaO2)*frac;
    r.setEnvironment({pao2MmHg:pao2,paco2MmHg:40});
    const s=r.snapshot();
    const f=flows(s);
    sum.hr+=s.hemodynamics.heartRatePerMin;
    sum.map+=s.hemodynamics.systemicArterialPressureMmHg;
    sum.co+=s.hemodynamics.leftVentricleOutflowMlPerSec;
    sum.vt+=s.ventilation.activeTidalVolumeL;
    sum.autoregulated+=f.autoregulated;
    sum.remaining+=f.remaining;
    if(s.autonomic){
      sum.fAb+=s.autonomic.fAbSpikesPerSec;
      sum.fSp+=s.autonomic.fSpSpikesPerSec;
      sum.fSh+=s.autonomic.fShSpikesPerSec;
      sum.fV+=s.autonomic.fVSpikesPerSec;
    }
    r.step();
  }
  for(const k of Object.keys(sum)) sum[k]/=n;
  bins.push({
    secondStart:second,
    secondEnd:second+1,
    meanPaO2MmHg:(startPaO2+endPaO2)/2,
    ...sum,
    mapPct:100*(sum.map-baseline.map)/baseline.map,
    hrPct:100*(sum.hr-baseline.hr)/baseline.hr,
    coPct:100*(sum.co-baseline.co)/baseline.co,
  });
}

console.log(JSON.stringify({
  schema:'ursino-magosso-2000-fig11-first20s-phase-audit/v1',
  authority:'diagnostic-source-reproduction-only',
  baseline,
  bins,
},null,2));
