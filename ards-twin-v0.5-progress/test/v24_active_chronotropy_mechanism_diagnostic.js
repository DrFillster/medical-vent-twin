'use strict';

const {
  createV2SourceAutonomicController,
}=require('../src/v2_source_autonomic_controller.js');

function run(controller,seconds,input){
  let s;
  for(let i=0;i<seconds*10;i++){
    s=controller.step({dtSec:0.1,...input});
  }
  return s;
}

function pick(s){
  return {
    appliedHrPerMin:s.heartRatePerMin,
    hummod2013HrPerMin:s.hummod2013HeartRatePerMin,
    albaneseComparatorHrPerMin:s.albaneseComparatorHeartRatePerMin,
    cardiacSympatheticHz:s.chronotropy.sympathetic.cardiacHz,
    adrenalSympatheticHz:s.chronotropy.sympathetic.adrenalHz,
    generalSympatheticHz:s.chronotropy.sympathetic.generalHz,
    vagusHz:s.chronotropy.saNode.vagusHz,
    nePgPerMl:s.chronotropy.catecholamines.nePgPerMl,
    epiPgPerMl:s.chronotropy.catecholamines.epiPgPerMl,
    beta1Effect:s.chronotropy.catecholamines.beta1Effect,
    sympatheticSaNodeEffectPerMin:s.chronotropy.saNode.sympatheticEffectPerMin,
    parasympatheticSaNodeEffectPerMin:s.chronotropy.saNode.parasympatheticEffectPerMin,
    albaneseFShSpikesPerSec:s.autonomic.fShSpikesPerSec,
    albaneseFVSpikesPerSec:s.autonomic.fVSpikesPerSec,
    sourceHeartPeriodSec:s.sourceHeartPeriodSec,
    appliedHeartPeriodSec:s.appliedHeartPeriodSec,
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

const challenge=run(c,120,{
  meanArterialPressureMmHg:104,
  tidalVolumeL:0.10,
  arterialPo2MmHg:35,
  arterialPco2MmHg:110,
  arterialPh:6.90,
});

console.log(JSON.stringify({
  model:'v2.4 active HumMod 2012/2013 SA-node chronotropy with Albanese comparator',
  baseline:pick(baseline),
  challenge:pick(challenge),
},null,2));
