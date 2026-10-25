'use strict';

const {
  createUrsinoBaroreceptorShadow,
}=require('../src/ursino_baroreceptor_shadow.js');
const {
  createAlbanese2016AutonomicCandidate,
}=require('../src/albanese_2016_autonomic_candidate.js');
const {
  createChannelizedEffectorCandidate,
}=require('../src/ursino_magosso_channelized_effectors_candidate.js');

function simulate({map,pao2,paco2,pH,vt,seconds=120}){
  const b=createUrsinoBaroreceptorShadow();
  const a=createAlbanese2016AutonomicCandidate();
  let e=null;
  let last=null;
  for(let i=0;i<seconds*10;i++){
    const br=b.step({dtSec:0.1,arterialPressureMmHg:map});
    const au=a.step({
      dtSec:0.1,
      pao2MmHg:pao2,
      paco2MmHg:paco2,
      fAbSpikesPerSec:br.fAbSpikesPerSec,
      tidalVolumeL:vt,
    });
    if(e==null){
      e=createChannelizedEffectorCandidate({
        initialFSpSpikesPerSec:au.fSpSpikesPerSec,
        initialFSvSpikesPerSec:au.fSvSpikesPerSec,
        initialFShSpikesPerSec:au.fShSpikesPerSec,
        initialFVSpikesPerSec:au.fVSpikesPerSec,
      });
    }
    const ef=e.step({
      dtSec:0.1,
      fSpSpikesPerSec:au.fSpSpikesPerSec,
      fSvSpikesPerSec:au.fSvSpikesPerSec,
      fShSpikesPerSec:au.fShSpikesPerSec,
      fVSpikesPerSec:au.fVSpikesPerSec,
    });
    last={br,au,ef,hr:60/ef.absolute.heartPeriodSec,pH};
  }
  return last;
}

const baseline=simulate({map:82,pao2:90,paco2:40,pH:7.4,vt:0.42,seconds:60});
const severe=simulate({map:104,pao2:35,paco2:110,pH:6.9,vt:0.10,seconds:120});
const severeLowMap=simulate({map:70,pao2:35,paco2:110,pH:6.9,vt:0.10,seconds:120});

console.log(JSON.stringify({
  baseline:{
    hr:baseline.hr,
    fAb:baseline.br.fAbSpikesPerSec,
    fAc:baseline.au.fAcSpikesPerSec,
    fAp:baseline.au.fApSpikesPerSec,
    fSh:baseline.au.fShSpikesPerSec,
    fV:baseline.au.fVSpikesPerSec,
    heartPeriod:baseline.ef.absolute.heartPeriodSec,
  },
  severeHighMap:{
    hr:severe.hr,
    fAb:severe.br.fAbSpikesPerSec,
    fAc:severe.au.fAcSpikesPerSec,
    fAp:severe.au.fApSpikesPerSec,
    fSh:severe.au.fShSpikesPerSec,
    fV:severe.au.fVSpikesPerSec,
    heartPeriod:severe.ef.absolute.heartPeriodSec,
  },
  severeLowMap:{
    hr:severeLowMap.hr,
    fAb:severeLowMap.br.fAbSpikesPerSec,
    fAc:severeLowMap.au.fAcSpikesPerSec,
    fAp:severeLowMap.au.fApSpikesPerSec,
    fSh:severeLowMap.au.fShSpikesPerSec,
    fV:severeLowMap.au.fVSpikesPerSec,
    heartPeriod:severeLowMap.ef.absolute.heartPeriodSec,
  }
},null,2));
