'use strict';

const {createV2SourceAutonomicController}=require('../src/v2_source_autonomic_controller.js');

function run(controller,seconds,input){
  let s;
  for(let i=0;i<seconds*10;i++){
    s=controller.step({dtSec:0.1,...input});
  }
  return s;
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
const challenge=run(c,120,{
  meanArterialPressureMmHg:104,
  tidalVolumeL:0.10,
  arterialPo2MmHg:35,
  arterialPco2MmHg:110,
  arterialPh:6.90,
});

const cNormalPressure=createV2SourceAutonomicController({
  baseline:{
    heartRatePerMin:75,
    systemicArterialConductanceMlPerMinPerMmHg:60,
    systemicVenousV0Ml:1700,
  },
});
run(cNormalPressure,60,{
  meanArterialPressureMmHg:82,
  tidalVolumeL:0.42,
  arterialPo2MmHg:90,
  arterialPco2MmHg:40,
  arterialPh:7.40,
});
const lowMapChallenge=run(cNormalPressure,120,{
  meanArterialPressureMmHg:70,
  tidalVolumeL:0.10,
  arterialPo2MmHg:35,
  arterialPco2MmHg:110,
  arterialPh:6.90,
});

const cNormalVt=createV2SourceAutonomicController({
  baseline:{
    heartRatePerMin:75,
    systemicArterialConductanceMlPerMinPerMmHg:60,
    systemicVenousV0Ml:1700,
  },
});
run(cNormalVt,60,{
  meanArterialPressureMmHg:82,
  tidalVolumeL:0.42,
  arterialPo2MmHg:90,
  arterialPco2MmHg:40,
  arterialPh:7.40,
});
const normalVtChallenge=run(cNormalVt,120,{
  meanArterialPressureMmHg:104,
  tidalVolumeL:0.50,
  arterialPo2MmHg:35,
  arterialPco2MmHg:110,
  arterialPh:6.90,
});

console.log(JSON.stringify({
  baseline:{
    hr:baseline.heartRatePerMin,
    fAb:baseline.afferents.fAbSpikesPerSec,
    fAc:baseline.afferents.fAcSpikesPerSec,
    fSh:baseline.autonomic.fShSpikesPerSec,
    fV:baseline.autonomic.fVSpikesPerSec,
    heartPeriod:baseline.sourceHeartPeriodSec,
  },
  challenge:{
    hr:challenge.heartRatePerMin,
    fAb:challenge.afferents.fAbSpikesPerSec,
    fAc:challenge.afferents.fAcSpikesPerSec,
    fSh:challenge.autonomic.fShSpikesPerSec,
    fV:challenge.autonomic.fVSpikesPerSec,
    heartPeriod:challenge.sourceHeartPeriodSec,
    effectors:challenge.effectors,
  },
  lowMapSameGas:{
    hr:lowMapChallenge.heartRatePerMin,
    fAb:lowMapChallenge.afferents.fAbSpikesPerSec,
    fAc:lowMapChallenge.afferents.fAcSpikesPerSec,
    fSh:lowMapChallenge.autonomic.fShSpikesPerSec,
    fV:lowMapChallenge.autonomic.fVSpikesPerSec,
    heartPeriod:lowMapChallenge.sourceHeartPeriodSec,
  },
  normalVtSameGasHighMap:{
    hr:normalVtChallenge.heartRatePerMin,
    fAb:normalVtChallenge.afferents.fAbSpikesPerSec,
    fAc:normalVtChallenge.afferents.fAcSpikesPerSec,
    fSh:normalVtChallenge.autonomic.fShSpikesPerSec,
    fV:normalVtChallenge.autonomic.fVSpikesPerSec,
    heartPeriod:normalVtChallenge.sourceHeartPeriodSec,
  }
},null,2));
