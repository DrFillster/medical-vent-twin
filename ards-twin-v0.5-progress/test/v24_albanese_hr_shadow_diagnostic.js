'use strict';

const {createUrsinoBaroreceptorShadow}=require('../src/ursino_baroreceptor_shadow.js');
const {createAlbanese2016AutonomicCandidate}=require('../src/albanese_2016_autonomic_candidate.js');
const {createChannelizedEffectorCandidate}=require('../src/ursino_magosso_channelized_effectors_candidate.js');

function runScenario({baselineSec=60,challengeSec=120,challenge}={}){
  const baro=createUrsinoBaroreceptorShadow();
  const auto=createAlbanese2016AutonomicCandidate();
  let eff=null;
  let state=null;

  function step(input){
    const b=baro.step({
      dtSec:0.1,
      arterialPressureMmHg:input.meanArterialPressureMmHg,
    });
    const a=auto.step({
      dtSec:0.1,
      pao2MmHg:input.arterialPo2MmHg,
      paco2MmHg:input.arterialPco2MmHg,
      fAbSpikesPerSec:b.fAbSpikesPerSec,
      tidalVolumeL:input.tidalVolumeL,
    });
    if(eff==null){
      eff=createChannelizedEffectorCandidate({
        initialFSpSpikesPerSec:a.fSpSpikesPerSec,
        initialFSvSpikesPerSec:a.fSvSpikesPerSec,
        initialFShSpikesPerSec:a.fShSpikesPerSec,
        initialFVSpikesPerSec:a.fVSpikesPerSec,
      });
    }
    const e=eff.step({
      dtSec:0.1,
      fSpSpikesPerSec:a.fSpSpikesPerSec,
      fSvSpikesPerSec:a.fSvSpikesPerSec,
      fShSpikesPerSec:a.fShSpikesPerSec,
      fVSpikesPerSec:a.fVSpikesPerSec,
    });
    state={baro:b,autonomic:a,effectors:e,hr:60/e.absolute.heartPeriodSec};
    return state;
  }

  const baseline={
    meanArterialPressureMmHg:82,
    tidalVolumeL:0.42,
    arterialPo2MmHg:90,
    arterialPco2MmHg:40,
  };
  for(let i=0;i<baselineSec*10;i++) step(baseline);
  const before=state;
  for(let i=0;i<challengeSec*10;i++) step(challenge);
  return {baseline:before,challenge:state};
}

function pick(s){
  return {
    hr:s.hr,
    fAb:s.baro.fAbSpikesPerSec,
    fAc:s.autonomic.fAcSpikesPerSec,
    fAp:s.autonomic.fApSpikesPerSec,
    fSh:s.autonomic.fShSpikesPerSec,
    fV:s.autonomic.fVSpikesPerSec,
    heartPeriod:s.effectors.absolute.heartPeriodSec,
  };
}

const highMap=runScenario({challenge:{
  meanArterialPressureMmHg:104,
  tidalVolumeL:0.10,
  arterialPo2MmHg:35,
  arterialPco2MmHg:110,
}});
const lowMap=runScenario({challenge:{
  meanArterialPressureMmHg:70,
  tidalVolumeL:0.10,
  arterialPo2MmHg:35,
  arterialPco2MmHg:110,
}});
const normalVt=runScenario({challenge:{
  meanArterialPressureMmHg:104,
  tidalVolumeL:0.50,
  arterialPo2MmHg:35,
  arterialPco2MmHg:110,
}});

console.log(JSON.stringify({
  model:'Albanese2016 Table-7 calibration + Ursino/Magosso effectors',
  highMapLowVt:{baseline:pick(highMap.baseline),challenge:pick(highMap.challenge)},
  lowMapLowVt:{challenge:pick(lowMap.challenge)},
  highMapNormalVt:{challenge:pick(normalVt.challenge)},
},null,2));
