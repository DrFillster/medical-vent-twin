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

function meanRows(rows){
  const out={map:0,hr:0,co:0,autoregulated:0,remaining:0};
  for(const row of rows) for(const k of Object.keys(out)) out[k]+=row[k];
  for(const k of Object.keys(out)) out[k]/=rows.length;
  return out;
}

function collectBeats(r,durationSec,envFn){
  let elapsed=0,prior=r.snapshot().vascularState.phase,inBeat=false;
  let start=0,sums=null,duration=0;
  const beats=[];
  while(elapsed<durationSec-1e-12){
    if(envFn) envFn(elapsed,r);
    const s=r.snapshot(),phase=s.vascularState.phase,wrapped=phase<prior;
    if(wrapped){
      if(inBeat&&duration>0){
        const m={};
        for(const [k,v] of Object.entries(sums)) m[k]=v/duration;
        beats.push({startSec:start,endSec:elapsed,midpointSec:(start+elapsed)/2,...m});
      }
      inBeat=true; start=elapsed;
      sums={map:0,hr:0,co:0,autoregulated:0,remaining:0}; duration=0;
    }
    if(inBeat){
      const x=sample(s);
      for(const k of Object.keys(sums)) sums[k]+=x[k]*DT;
      duration+=DT;
    }
    prior=phase; r.step(); elapsed+=DT;
  }
  return beats;
}

function pct(x,b){
  const out={};
  for(const k of Object.keys(x)) out[k]=100*(x[k]-b[k])/b[k];
  return out;
}

function run(enabledBeds){
  const r=createUrsinoMagosso2000ExpandedHypoxiaClosedLoop({
    dtSec:DT,pao2MmHg:95,paco2MmHg:40,
    ventilationMode:'ursino-magosso-2000-spontaneous-validation',
    diagnosticLocalO2Mode:'source',
    diagnosticLocalO2EnabledBeds:enabledBeds,
  });
  r.runFor(120);
  const baseline=meanRows(collectBeats(r,10,null));
  const challenge=collectBeats(r,10,(t,rt)=>rt.setEnvironment({
    pao2MmHg:95+(28-95)*(t/10),paco2MmHg:40,
  }));
  const earlyBeats=challenge.filter(b=>b.midpointSec>=8&&b.midpointSec<=10);
  if(!earlyBeats.length) throw new Error('no early beats');
  const early=meanRows(earlyBeats);
  return {enabledBeds,baseline,early,pct:pct(early,baseline),earlyBeats};
}

const source=run(['muscle','brain','heart']);
const noMuscle=run(['brain','heart']);

const out={
  schema:'ursino-magosso-2000-muscle-local-o2-isolation/v1',
  authority:'diagnostic-source-component-only',
  measurement:'complete-ventricular-cycle means',
  source,noMuscle,
  deltaEarlyMapPct:noMuscle.pct.map-source.pct.map,
};

const dir=path.resolve(__dirname,'../physician-audit-results');
fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(
  path.join(dir,'ursino-magosso-2000-muscle-local-o2-isolation.json'),
  JSON.stringify(out,null,2)+'\n'
);
console.log(JSON.stringify(out,null,2));
