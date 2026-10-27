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

function pick(tSec,s){
  return {
    tSec,
    appliedHrPerMin:s.heartRatePerMin,
    albaneseComparatorHrPerMin:s.albaneseComparatorHeartRatePerMin,
    cardiacSympatheticHz:s.chronotropy.sympathetic.cardiacHz,
    vagusHz:s.chronotropy.saNode.vagusHz,
    nePgPerMl:s.chronotropy.catecholamines.nePgPerMl,
    epiPgPerMl:s.chronotropy.catecholamines.epiPgPerMl,
    beta1Effect:s.chronotropy.catecholamines.beta1Effect,
    sympatheticSaNodeEffectPerMin:s.chronotropy.saNode.sympatheticEffectPerMin,
    parasympatheticSaNodeEffectPerMin:s.chronotropy.saNode.parasympatheticEffectPerMin,
    chemoCnsEffect:s.chronotropy.chemoreceptorsCns.effect,
    chemoCnsChange:s.chronotropy.chemoreceptorsCns.change,
  };
}

const c=createV2SourceAutonomicController({
  baseline:{
    heartRatePerMin:75,
    systemicArterialConductanceMlPerMinPerMmHg:60,
    systemicVenousV0Ml:1700,
  },
});

const baselineInput={
  meanArterialPressureMmHg:82,
  tidalVolumeL:0.42,
  arterialPo2MmHg:90,
  arterialPco2MmHg:40,
  arterialPh:7.40,
};

const challengeInput={
  meanArterialPressureMmHg:104,
  tidalVolumeL:0.10,
  arterialPo2MmHg:35,
  arterialPco2MmHg:110,
  arterialPh:6.90,
};

run(c,60,baselineInput);

const samples=[];
let elapsed=0;
for(const target of [30,60,120,300,600,1200]){
  run(c,target-elapsed,challengeInput);
  elapsed=target;
  samples.push(pick(elapsed,c.snapshot()));
}

console.log(JSON.stringify({
  model:'v2.4 active HumMod 2012/2013 SA-node severe-challenge time course',
  challenge:challengeInput,
  samples,
},null,2));
