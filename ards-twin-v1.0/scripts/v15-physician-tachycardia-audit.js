#!/usr/bin/env node
'use strict';

const {
  createPhysicianValidationCandidate,
}=require('../src/physician_validation_candidate.js');
const {
  createUrsinoMagosso2000ExpandedHypoxiaClosedLoop,
}=require('../src/ursino_magosso_2000_expanded_hypoxia_closed_loop.js');

const DT=0.002;

function candidateRow(s,label){
  const a=s.autonomic||{};
  return {
    label,
    timeSec:s.timeSec,
    heartRatePerMin:s.heartRatePerMin,
    meanArterialPressureMmHg:s.meanArterialPressureMmHg,
    cardiacOutputMlPerMin:s.cardiacOutputMlPerMin,
    strokeVolumeMl:s.strokeVolumeMl,
    systemicPeripheralResistanceMmHgMinPerL:
      s.systemicPeripheralResistanceMmHgMinPerL,
    pao2MmHg:s.inputs?.pao2MmHg,
    paco2MmHg:s.inputs?.paco2MmHg,
    tidalVolumeL:s.inputs?.tidalVolumeL,
    fAcSpikesPerSec:a.fAcSpikesPerSec,
    fShSpikesPerSec:a.fShSpikesPerSec,
    fVSpikesPerSec:a.fVSpikesPerSec,
    thetaSh:a.thetaSh,
  };
}

function expandedRow(s,label){
  const a=s.autonomic||{};
  return {
    label,
    timeSec:s.timeSec,
    heartRatePerMin:s.hemodynamics?.heartRatePerMin,
    meanArterialPressureMmHg:s.hemodynamics?.systemicArterialPressureMmHg,
    cardiacOutputMlPerMin:
      Number.isFinite(s.hemodynamics?.leftVentricleOutflowMlPerSec)
        ?s.hemodynamics.leftVentricleOutflowMlPerSec*60
        :null,
    pao2MmHg:s.environment?.pao2MmHg,
    paco2MmHg:s.environment?.paco2MmHg,
    tidalVolumeL:s.ventilation?.activeTidalVolumeL,
    fAcSpikesPerSec:a.fAcSpikesPerSec,
    fShSpikesPerSec:a.fShSpikesPerSec,
    fVSpikesPerSec:a.fVSpikesPerSec,
    thetaSh:a.thetaShSpikesPerSec,
  };
}

function track({snapshot,step,seconds,row,label,maxState}){
  const n=Math.round(seconds/DT);
  for(let i=0;i<n;i++){
    const s=snapshot();
    const r=row(s,label);
    if(Number.isFinite(r.heartRatePerMin)){
      if(!maxState.row||r.heartRatePerMin>maxState.row.heartRatePerMin){
        maxState.row=r;
      }
      if(maxState.firstAbove100==null&&r.heartRatePerMin>100){
        maxState.firstAbove100=r;
      }
    }
    step();
  }
}

function runPhysicianProtocol(name,segments){
  const r=createPhysicianValidationCandidate({
    dtSec:DT,
    pao2MmHg:95,
    paco2MmHg:40,
    tidalVolumeL:0.5,
    averagingWindowSec:1,
  });
  const maxState={row:null,firstAbove100:null};
  const phases=[];

  track({
    snapshot:r.snapshot,
    step:()=>r.runFor(DT),
    seconds:120,
    row:candidateRow,
    label:'baseline-settle',
    maxState,
  });
  phases.push(candidateRow(r.snapshot(),'baseline'));

  for(const seg of segments){
    r.setEnvironment({
      pao2MmHg:seg.pao2MmHg,
      paco2MmHg:seg.paco2MmHg,
      tidalVolumeL:seg.tidalVolumeL,
    });
    track({
      snapshot:r.snapshot,
      step:()=>r.runFor(DT),
      seconds:seg.seconds,
      row:candidateRow,
      label:seg.label,
      maxState,
    });
    phases.push(candidateRow(r.snapshot(),seg.label));
  }

  return {
    name,
    authority:'physician-validation-parallel-candidate',
    ventilationMode:'external-delivered-vt',
    phases,
    maximum:maxState.row,
    firstAbove100:maxState.firstAbove100,
    exceeded100:Boolean(maxState.firstAbove100),
  };
}

function runSourceFig11(){
  const r=createUrsinoMagosso2000ExpandedHypoxiaClosedLoop({
    dtSec:DT,
    pao2MmHg:95,
    paco2MmHg:40,
    ventilationMode:'ursino-magosso-2000-spontaneous-validation',
  });
  const maxState={row:null,firstAbove100:null};
  const phases=[];

  track({
    snapshot:r.snapshot,
    step:r.step,
    seconds:120,
    row:expandedRow,
    label:'baseline-settle',
    maxState,
  });
  phases.push(expandedRow(r.snapshot(),'baseline'));

  const rampSec=10;
  const n=Math.round(rampSec/DT);
  for(let i=0;i<n;i++){
    const fraction=(i+1)/n;
    r.setEnvironment({
      pao2MmHg:95+(28-95)*fraction,
      paco2MmHg:40,
    });
    const s=r.snapshot();
    const rr=expandedRow(s,'95-to-28-ramp');
    if(Number.isFinite(rr.heartRatePerMin)){
      if(!maxState.row||rr.heartRatePerMin>maxState.row.heartRatePerMin){
        maxState.row=rr;
      }
      if(maxState.firstAbove100==null&&rr.heartRatePerMin>100){
        maxState.firstAbove100=rr;
      }
    }
    r.step();
  }
  phases.push(expandedRow(r.snapshot(),'end-ramp'));

  r.setEnvironment({pao2MmHg:28,paco2MmHg:40});
  track({
    snapshot:r.snapshot,
    step:r.step,
    seconds:60,
    row:expandedRow,
    label:'deep-isocapnic-hypoxia-hold',
    maxState,
  });
  phases.push(expandedRow(r.snapshot(),'60s-hold'));

  return {
    name:'source-fig11-spontaneous-validation',
    authority:'source-reproduction-candidate-not-canonical',
    source:'Ursino & Magosso 2000 Fig. 11',
    ventilationMode:'ursino-magosso-2000-spontaneous-validation',
    phases,
    maximum:maxState.row,
    firstAbove100:maxState.firstAbove100,
    exceeded100:Boolean(maxState.firstAbove100),
  };
}

const out={
  schema:'v15-physician-tachycardia-audit/v1',
  purpose:
    'Determine whether the physician-facing candidate can produce tachycardia >100/min without adding or refitting physiology.',
  acceptanceRequestedByPhysician:
    'At least one physiologically appropriate candidate challenge should demonstrate HR >100/min; source reproduction remains separately judged against source behavior.',
  protocols:[
    runPhysicianProtocol('controlled-deep-isocapnic-hypoxia',[
      {
        label:'deep-isocapnic-hypoxia',
        pao2MmHg:28,
        paco2MmHg:40,
        tidalVolumeL:0.5,
        seconds:60,
      },
    ]),
    runPhysicianProtocol('controlled-combined-respiratory-failure',[
      {
        label:'combined-stage-1',
        pao2MmHg:65,
        paco2MmHg:50,
        tidalVolumeL:0.5,
        seconds:60,
      },
      {
        label:'combined-stage-2',
        pao2MmHg:50,
        paco2MmHg:60,
        tidalVolumeL:0.4,
        seconds:60,
      },
      {
        label:'combined-stage-3',
        pao2MmHg:40,
        paco2MmHg:75,
        tidalVolumeL:0.3,
        seconds:120,
      },
    ]),
    runSourceFig11(),
  ],
};

console.log(JSON.stringify(out,null,2));
