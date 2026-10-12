#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {
  createUrsinoMagosso2000ExpandedHypoxiaClosedLoop,
}=require('../src/ursino_magosso_2000_expanded_hypoxia_closed_loop.js');

const DT=0.002;

function sample(s){
  const p=s.vascularState,e=s.vascularEffectors;
  return {
    map:s.hemodynamics.systemicArterialPressureMmHg,
    hr:s.hemodynamics.heartRatePerMin,
    co:s.hemodynamics.leftVentricleOutflowMlPerSec,
    autoregulated:
      (p.Psp-p.Pmv)/e.Rmp+
      (p.Psp-p.Pbv)/e.Rbp+
      (p.Psp-p.Phv)/e.Rhp,
    remaining:
      (p.Psp-p.Psv)/e.Rsp+
      (p.Psp-p.Pev)/e.Rep,
  };
}

function meanWindow(r,seconds){
  const n=Math.round(seconds/DT),sum={map:0,hr:0,co:0,autoregulated:0,remaining:0};
  for(let i=0;i<n;i++){
    const x=sample(r.snapshot());
    for(const k of Object.keys(sum)) sum[k]+=x[k];
    r.step();
  }
  for(const k of Object.keys(sum)) sum[k]/=n;
  return sum;
}

function run(mode){
  const r=createUrsinoMagosso2000ExpandedHypoxiaClosedLoop({
    dtSec:DT,pao2MmHg:95,paco2MmHg:40,
    ventilationMode:'ursino-magosso-2000-spontaneous-validation',
    diagnosticLocalO2Mode:mode,
  });
  r.runFor(120);
  const baseline=meanWindow(r,5);

  const rampSteps=Math.round(10/DT);
  let earlySum={map:0,hr:0,co:0,autoregulated:0,remaining:0},earlyN=0;
  for(let i=0;i<rampSteps;i++){
    const t=i*DT;
    const pao2=95+(28-95)*(t/10);
    r.setEnvironment({pao2MmHg:pao2,paco2MmHg:40});
    const x=sample(r.snapshot());
    if(t>=8){
      for(const k of Object.keys(earlySum)) earlySum[k]+=x[k];
      earlyN++;
    }
    r.step();
  }
  const early={};
  for(const k of Object.keys(earlySum)) early[k]=earlySum[k]/earlyN;

  const pct={};
  for(const k of Object.keys(early)){
    pct[k]=100*(early[k]-baseline[k])/baseline[k];
  }
  return {mode,baseline,early,pct};
}

const source=run('source');
const disabled=run('disabled');
const out={
  schema:'ursino-magosso-2000-local-o2-isolation/v1',
  authority:'diagnostic-source-component-only',
  source,
  disabled,
  interpretation:{
    question:'Does source local-O2 vascular control reverse the sign of the early SAP response in the current composition?',
    sourceEarlyMapPct:source.pct.map,
    disabledEarlyMapPct:disabled.pct.map,
  },
};

const dir=path.resolve(__dirname,'../physician-audit-results');
fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(
  path.join(dir,'ursino-magosso-2000-local-o2-isolation.json'),
  JSON.stringify(out,null,2)+'\n'
);
console.log(JSON.stringify(out,null,2));
