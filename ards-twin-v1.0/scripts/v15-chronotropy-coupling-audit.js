#!/usr/bin/env node
'use strict';

const {
  createUrsinoMagosso2000ExpandedHypoxiaClosedLoop,
}=require('../src/ursino_magosso_2000_expanded_hypoxia_closed_loop.js');
const {
  sourceTargets,
}=require('../src/ursino_magosso_2000_split_effectors_candidate.js');

const DT=0.002;

function instantaneousTarget(s){
  const a=s.autonomic;
  if(!a) return null;
  const x=sourceTargets({
    vascularSympatheticSpikesPerSec:a.fSpSpikesPerSec,
    cardiacSympatheticSpikesPerSec:a.fShSpikesPerSec,
    cardiacVagalSpikesPerSec:a.fVSpikesPerSec,
  });
  const period=x.absolute.heartPeriodSec;
  return {
    heartPeriodSec:period,
    heartRatePerMin:Number.isFinite(period)&&period>0?60/period:null,
    sympatheticHeartPeriodChangeSec:x.delta.Ts,
    vagalHeartPeriodChangeSec:x.delta.Tv,
  };
}

function row(s,label){
  const target=instantaneousTarget(s);
  return {
    label,
    timeSec:s.timeSec,
    pao2MmHg:s.environment.pao2MmHg,
    paco2MmHg:s.environment.paco2MmHg,
    tidalVolumeL:s.ventilation.activeTidalVolumeL,
    actualHeartPeriodSec:s.hemodynamics.heartPeriodSec,
    actualHeartRatePerMin:s.hemodynamics.heartRatePerMin,
    instantaneousTargetHeartPeriodSec:target?.heartPeriodSec,
    instantaneousTargetHeartRatePerMin:target?.heartRatePerMin,
    sympatheticHeartPeriodChangeSec:target?.sympatheticHeartPeriodChangeSec,
    vagalHeartPeriodChangeSec:target?.vagalHeartPeriodChangeSec,
    fAbSpikesPerSec:s.autonomic?.fAbSpikesPerSec,
    fAcSpikesPerSec:s.autonomic?.fAcSpikesPerSec,
    fApSpikesPerSec:s.autonomic?.fApSpikesPerSec,
    fSpSpikesPerSec:s.autonomic?.fSpSpikesPerSec,
    fShSpikesPerSec:s.autonomic?.fShSpikesPerSec,
    fVSpikesPerSec:s.autonomic?.fVSpikesPerSec,
    thetaSp:s.autonomic?.thetaSpSpikesPerSec,
    thetaSh:s.autonomic?.thetaShSpikesPerSec,
    mapMmHg:s.hemodynamics.systemicArterialPressureMmHg,
  };
}

function collectMaxima(r,{seconds,label}){
  const n=Math.round(seconds/DT);
  let maxActual=null,maxTarget=null,minPeriod=null;
  for(let i=0;i<n;i++){
    const x=row(r.snapshot(),label);
    if(Number.isFinite(x.actualHeartRatePerMin)&&
       (!maxActual||x.actualHeartRatePerMin>maxActual.actualHeartRatePerMin)){
      maxActual=x;
    }
    if(Number.isFinite(x.instantaneousTargetHeartRatePerMin)&&
       (!maxTarget||
        x.instantaneousTargetHeartRatePerMin>maxTarget.instantaneousTargetHeartRatePerMin)){
      maxTarget=x;
    }
    if(Number.isFinite(x.actualHeartPeriodSec)&&
       (!minPeriod||x.actualHeartPeriodSec<minPeriod.actualHeartPeriodSec)){
      minPeriod=x;
    }
    r.step();
  }
  return {maxActual,maxTarget,minActualPeriod:minPeriod};
}

function runControlled(){
  const r=createUrsinoMagosso2000ExpandedHypoxiaClosedLoop({
    dtSec:DT,
    pao2MmHg:95,
    paco2MmHg:40,
    tidalVolumeL:0.5,
    ventilationMode:'external-delivered-vt',
  });
  r.runFor(120);
  const baseline=row(r.snapshot(),'baseline');

  r.setEnvironment({pao2MmHg:28,paco2MmHg:40,tidalVolumeL:0.5});
  const deep=collectMaxima(r,{seconds:60,label:'deep-isocapnic-hypoxia'});
  const endpoint=row(r.snapshot(),'deep-isocapnic-hypoxia-end');

  return {
    name:'controlled-deep-isocapnic-hypoxia',
    ventilationMode:'external-delivered-vt',
    baseline,
    deep,
    endpoint,
  };
}

function runFig11(){
  const r=createUrsinoMagosso2000ExpandedHypoxiaClosedLoop({
    dtSec:DT,
    pao2MmHg:95,
    paco2MmHg:40,
    ventilationMode:'ursino-magosso-2000-spontaneous-validation',
  });
  r.runFor(120);
  const baseline=row(r.snapshot(),'baseline');

  const n=Math.round(10/DT);
  for(let i=0;i<n;i++){
    const fraction=(i+1)/n;
    r.setEnvironment({
      pao2MmHg:95+(28-95)*fraction,
      paco2MmHg:40,
    });
    r.step();
  }
  const endRamp=row(r.snapshot(),'end-ramp');

  r.setEnvironment({pao2MmHg:28,paco2MmHg:40});
  const hold=collectMaxima(r,{seconds:60,label:'deep-hypoxia-hold'});
  const endpoint=row(r.snapshot(),'deep-hypoxia-hold-end');

  return {
    name:'ursino-magosso-2000-fig11',
    ventilationMode:'ursino-magosso-2000-spontaneous-validation',
    baseline,
    endRamp,
    hold,
    endpoint,
  };
}

const out={
  schema:'v15-chronotropy-coupling-audit/v1',
  authority:'diagnostic-only-no-physiology-change',
  purpose:
    'Locate whether inadequate tachycardia arises upstream in autonomic drive, in the delayed heart-period effector, or in application of heart period to the cardiovascular plant.',
  sourceEquationFamily:{
    autonomic:'Ursino & Magosso 2000 Eqs. 17, 19, 21-23',
    heartPeriodEffectors:'Ursino & Magosso 2000 Eqs. 30-40, Table 2',
  },
  protocols:[runControlled(),runFig11()],
};

console.log(JSON.stringify(out,null,2));
