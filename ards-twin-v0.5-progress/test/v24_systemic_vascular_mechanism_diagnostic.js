'use strict';

const {
  createV2SourceAutonomicController,
}=require('../src/v2_source_autonomic_controller.js');

function run(c,seconds,input){
  let s;
  for(let i=0;i<seconds;i++) s=c.step({dtSec:1,...input});
  return s;
}

function pick(s){
  return {
    hr:s.heartRatePerMin,
    map:s.meanArterialPressureMmHg,
    pao2:s.arterialPo2MmHg,
    paco2:s.arterialPco2MmHg,
    pH:s.arterialPh,
    fAb:s.afferents.fAbSpikesPerSec,
    fAc:s.afferents.fAcSpikesPerSec,
    fAp:s.afferents.fApSpikesPerSec,
    fSp:s.autonomic.fSpSpikesPerSec,
    fSv:s.autonomic.fSvSpikesPerSec,
    fSh:s.autonomic.fShSpikesPerSec,
    fV:s.autonomic.fVSpikesPerSec,
    sourceRsp:s.effectors.Rsp,
    sourceRep:s.effectors.Rep,
    sourceSystemicResistanceRatio:s.sourceSystemicResistanceRatio,
    hypercapnicSystemicResistanceRatio:s.hypercapnicSystemicResistanceRatio,
    preHypercapniaConductance:
      s.sourceAutonomicSystemicArterialConductanceMlPerMinPerMmHg,
    appliedConductance:s.systemicArterialConductanceMlPerMinPerMmHg,
    hummodBaroreflex:s.chronotropy.baroreflex,
  };
}

const c=createV2SourceAutonomicController({
  baseline:{
    heartRatePerMin:75,
    systemicArterialConductanceMlPerMinPerMmHg:60,
    systemicVenousV0Ml:1700,
  },
});

const baseline=run(c,60,{
  meanArterialPressureMmHg:82,
  tidalVolumeL:0.42,
  arterialPo2MmHg:90,
  arterialPco2MmHg:40,
  arterialPh:7.40,
});

const samples=[];
for(const row of [
  {seconds:30,map:108,pao2:25,paco2:48,pH:7.34},
  {seconds:30,map:119,pao2:18,paco2:54,pH:7.29},
  {seconds:60,map:137,pao2:16,paco2:68,pH:7.19},
  {seconds:60,map:128,pao2:16,paco2:84,pH:7.10},
  {seconds:120,map:132,pao2:16,paco2:118,pH:6.95},
  {seconds:120,map:50,pao2:21,paco2:180,pH:6.77},
]){
  const s=run(c,row.seconds,{
    meanArterialPressureMmHg:row.map,
    tidalVolumeL:0.10,
    arterialPo2MmHg:row.pao2,
    arterialPco2MmHg:row.paco2,
    arterialPh:row.pH,
  });
  samples.push({afterSec:row.seconds,input:row,state:pick(s)});
}

console.log(JSON.stringify({
  model:'v2.4 systemic vascular mechanism diagnostic',
  baseline:pick(baseline),
  samples,
},null,2));
