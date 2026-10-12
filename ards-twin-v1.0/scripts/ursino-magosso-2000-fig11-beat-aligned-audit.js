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

function integrateBeat(r,startElapsedSec,endElapsedSec){
  let prior=r.snapshot();
  let priorPhase=prior.vascularState.phase;
  let inBeat=false;
  let beatStartElapsed=null;
  let sums=null;
  let duration=0;
  const beats=[];

  function sample(s){
    const f=flows(s);
    return {
      map:s.hemodynamics.systemicArterialPressureMmHg,
      co:s.hemodynamics.leftVentricleOutflowMlPerSec,
      hr:s.hemodynamics.heartRatePerMin,
      remaining:f.remaining,
      autoregulated:f.autoregulated,
      vt:s.ventilation.activeTidalVolumeL,
    };
  }

  let elapsed=startElapsedSec;
  while(elapsed<endElapsedSec-1e-12){
    const s=r.snapshot();
    const phase=s.vascularState.phase;
    const wrapped=phase<priorPhase;

    if(wrapped){
      if(inBeat&&duration>0){
        const mean={};
        for(const [k,v] of Object.entries(sums)) mean[k]=v/duration;
        beats.push({
          startSec:beatStartElapsed,
          endSec:elapsed,
          midpointSec:(beatStartElapsed+elapsed)/2,
          durationSec:duration,
          ...mean,
        });
      }
      inBeat=true;
      beatStartElapsed=elapsed;
      sums={map:0,co:0,hr:0,remaining:0,autoregulated:0,vt:0};
      duration=0;
    }

    if(inBeat){
      const x=sample(s);
      for(const k of Object.keys(sums)) sums[k]+=x[k]*DT;
      duration+=DT;
    }

    priorPhase=phase;
    prior=s;
    r.step();
    elapsed+=DT;
  }
  return beats;
}

const r=createUrsinoMagosso2000ExpandedHypoxiaClosedLoop({
  dtSec:DT,
  pao2MmHg:95,
  paco2MmHg:40,
  ventilationMode:'ursino-magosso-2000-spontaneous-validation',
});

r.runFor(120);

// Collect basal beats first with no perturbation.
const baselineBeats=integrateBeat(r,-10,0);
const baselineMean={};
for(const key of ['map','co','hr','remaining','autoregulated','vt']){
  baselineMean[key]=baselineBeats.reduce((a,b)=>a+b[key],0)/baselineBeats.length;
}

// Run 60 s source protocol, recording complete beats.
let elapsed=0;
let priorPhase=r.snapshot().vascularState.phase;
let inBeat=false;
let beatStart=0;
let sums=null;
let duration=0;
const beats=[];

while(elapsed<60-1e-12){
  const pao2=elapsed<10?95+(28-95)*(elapsed/10):28;
  r.setEnvironment({pao2MmHg:pao2,paco2MmHg:40});

  const s=r.snapshot();
  const phase=s.vascularState.phase;
  const wrapped=phase<priorPhase;

  if(wrapped){
    if(inBeat&&duration>0){
      const mean={};
      for(const [k,v] of Object.entries(sums)) mean[k]=v/duration;
      beats.push({
        startSec:beatStart,
        endSec:elapsed,
        midpointSec:(beatStart+elapsed)/2,
        durationSec:duration,
        ...mean,
      });
    }
    inBeat=true;
    beatStart=elapsed;
    sums={map:0,co:0,hr:0,remaining:0,autoregulated:0,vt:0};
    duration=0;
  }

  if(inBeat){
    const f=flows(s);
    const x={
      map:s.hemodynamics.systemicArterialPressureMmHg,
      co:s.hemodynamics.leftVentricleOutflowMlPerSec,
      hr:s.hemodynamics.heartRatePerMin,
      remaining:f.remaining,
      autoregulated:f.autoregulated,
      vt:s.ventilation.activeTidalVolumeL,
    };
    for(const k of Object.keys(sums)) sums[k]+=x[k]*DT;
    duration+=DT;
  }

  priorPhase=phase;
  r.step();
  elapsed+=DT;
}

for(const beat of beats){
  beat.pct={};
  for(const key of ['map','co','hr','remaining','autoregulated','vt']){
    beat.pct[key]=100*(beat[key]-baselineMean[key])/baselineMean[key];
  }
}

const out={
  schema:'ursino-magosso-2000-fig11-beat-aligned-audit/v1',
  authority:'source-reproduction-diagnostic-only',
  source:{doi:'10.1152/ajpheart.2000.279.1.H149',figure:'Fig. 11'},
  method:{
    dtSec:DT,
    settleSec:120,
    baselineBeatWindowSec:10,
    challengeSec:60,
    protocol:'PaO2 95 to 28 mmHg over 10 s then held; PaCO2 40; source spontaneous VT',
    measurement:'complete ventricular-cycle means only',
  },
  baselineMean,
  baselineBeats,
  beats,
};

const dir=path.resolve(__dirname,'../physician-audit-results');
fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(
  path.join(dir,'ursino-magosso-2000-fig11-beat-aligned-audit.json'),
  JSON.stringify(out,null,2)+'\n'
);
console.log(JSON.stringify(out,null,2));
