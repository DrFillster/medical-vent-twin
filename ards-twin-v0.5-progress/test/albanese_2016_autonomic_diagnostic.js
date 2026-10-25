'use strict';

const {createUrsinoBaroreceptorShadow}=require('../src/ursino_baroreceptor_shadow.js');
const {createAlbanese2016AutonomicCandidate}=require('../src/albanese_2016_autonomic_candidate.js');
const {createChannelizedEffectorCandidate}=require('../src/ursino_magosso_channelized_effectors_candidate.js');

function runScenario({map,vt,pao2,paco2,seconds=120}){
  const baro=createUrsinoBaroreceptorShadow();
  const a=createAlbanese2016AutonomicCandidate();
  let e=null;
  let state=null;
  for(let i=0;i<seconds*10;i++){
    const b=baro.step({dtSec:0.1,arterialPressureMmHg:map});
    const x=a.step({
      dtSec:0.1,
      pao2MmHg:pao2,
      paco2MmHg:paco2,
      fAbSpikesPerSec:b.fAbSpikesPerSec,
      tidalVolumeL:vt,
    });
    if(e==null){
      e=createChannelizedEffectorCandidate({
        initialFSpSpikesPerSec:x.fSpSpikesPerSec,
        initialFSvSpikesPerSec:x.fSvSpikesPerSec,
        initialFShSpikesPerSec:x.fShSpikesPerSec,
        initialFVSpikesPerSec:x.fVSpikesPerSec,
      });
    }
    const y=e.step({
      dtSec:0.1,
      fSpSpikesPerSec:x.fSpSpikesPerSec,
      fSvSpikesPerSec:x.fSvSpikesPerSec,
      fShSpikesPerSec:x.fShSpikesPerSec,
      fVSpikesPerSec:x.fVSpikesPerSec,
    });
    state={b,x,y,hr:60/y.absolute.heartPeriodSec};
  }
  return state;
}

const baseline=runScenario({map:82,vt:0.42,pao2:90,paco2:40,seconds:60});
const severe=runScenario({map:104,vt:0.10,pao2:35,paco2:110,seconds:120});
const hypercapnia=runScenario({map:89,vt:0.80,pao2:90,paco2:58.5,seconds:420});

console.log(JSON.stringify({
  baseline:{
    hr:baseline.hr,
    fAb:baseline.b.fAbSpikesPerSec,
    fAc:baseline.x.fAcSpikesPerSec,
    fAp:baseline.x.fApSpikesPerSec,
    fSh:baseline.x.fShSpikesPerSec,
    fV:baseline.x.fVSpikesPerSec,
    T:baseline.y.absolute.heartPeriodSec,
  },
  severe:{
    hr:severe.hr,
    fAb:severe.b.fAbSpikesPerSec,
    fAc:severe.x.fAcSpikesPerSec,
    fAp:severe.x.fApSpikesPerSec,
    fSh:severe.x.fShSpikesPerSec,
    fV:severe.x.fVSpikesPerSec,
    T:severe.y.absolute.heartPeriodSec,
  },
  hypercapnia7pctApprox:{
    hr:hypercapnia.hr,
    hrChangePct:100*(hypercapnia.hr/baseline.hr-1),
    fAb:hypercapnia.b.fAbSpikesPerSec,
    fAc:hypercapnia.x.fAcSpikesPerSec,
    fAp:hypercapnia.x.fApSpikesPerSec,
    fSh:hypercapnia.x.fShSpikesPerSec,
    fV:hypercapnia.x.fVSpikesPerSec,
    T:hypercapnia.y.absolute.heartPeriodSec,
  }
},null,2));
