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
  for(const r of rows){
    for(const k of Object.keys(out)) out[k]+=r[k];
  }
  for(const k of Object.keys(out)) out[k]/=rows.length;
  return out;
}

function collectCompleteBeats(r,durationSec,environmentFn){
  let elapsed=0;
  let priorPhase=r.snapshot().vascularState.phase;
  let inBeat=false;
  let beatStart=0;
  let sums=null;
  let beatDuration=0;
  const beats=[];

  while(elapsed<durationSec-1e-12){
    if(environmentFn) environmentFn(elapsed,r);

    const s=r.snapshot();
    const phase=s.vascularState.phase;
    const wrapped=phase<priorPhase;

    if(wrapped){
      if(inBeat&&beatDuration>0){
        const mean={};
        for(const [k,v] of Object.entries(sums)) mean[k]=v/beatDuration;
        beats.push({
          startSec:beatStart,
          endSec:elapsed,
          midpointSec:(beatStart+elapsed)/2,
          ...mean,
        });
      }
      inBeat=true;
      beatStart=elapsed;
      sums={map:0,hr:0,co:0,autoregulated:0,remaining:0};
      beatDuration=0;
    }

    if(inBeat){
      const x=sample(s);
      for(const k of Object.keys(sums)) sums[k]+=x[k]*DT;
      beatDuration+=DT;
    }

    priorPhase=phase;
    r.step();
    elapsed+=DT;
  }
  return beats;
}

function pct(row,baseline){
  const out={};
  for(const k of Object.keys(row)) out[k]=100*(row[k]-baseline[k])/baseline[k];
  return out;
}

function run(mode){
  const r=createUrsinoMagosso2000ExpandedHypoxiaClosedLoop({
    dtSec:DT,pao2MmHg:95,paco2MmHg:40,
    ventilationMode:'ursino-magosso-2000-spontaneous-validation',
    diagnosticLocalO2Mode:mode,
  });
  r.runFor(120);

  const baselineBeats=collectCompleteBeats(r,10,null);
  const baseline=meanRows(baselineBeats);

  const challengeBeats=collectCompleteBeats(
    r,10,
    (elapsed,runtime)=>{
      runtime.setEnvironment({
        pao2MmHg:95+(28-95)*(elapsed/10),
        paco2MmHg:40,
      });
    }
  );

  const earlyBeats=challengeBeats.filter(
    b=>b.midpointSec>=8&&b.midpointSec<=10
  );
  if(!earlyBeats.length) throw new Error('no complete beats in early 8-10 s window');
  const early=meanRows(earlyBeats);

  return {
    mode,
    baseline,
    early,
    pct:pct(early,baseline),
    baselineBeatCount:baselineBeats.length,
    earlyBeatCount:earlyBeats.length,
    earlyBeats,
  };
}

const source=run('source');
const disabled=run('disabled');

const out={
  schema:'ursino-magosso-2000-local-o2-isolation/v2',
  authority:'diagnostic-source-component-only',
  measurement:'complete-ventricular-cycle means',
  source,
  disabled,
  interpretation:{
    question:'Does source local-O2 vascular control reverse the sign of the early beat-aligned SAP response in the current composition?',
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
