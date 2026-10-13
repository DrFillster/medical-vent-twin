'use strict';

const assert=require('node:assert/strict');
const {
  createV16MyocardialUpstreamRuntime,
}=require('../src/v16_myocardial_upstream_runtime.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}

function zeroOutflows(){
  return {
    bone:0,brain:0,fat:0,giTract:0,rightKidney:0,leftKidney:0,
    leftHeart:0,liver:0,otherTissue:0,respiratoryMuscle:0,
    rightHeart:0,skeletalMuscle:0,skin:0,
  };
}

const gasSnapshot={
  boundary:{blood:{sidMolPerL:0.040}},
  gases:{arterial:{hco3MolPerL:0.024}},
};
const cardiopulmonarySnapshot={
  cardiovascular:{
    myocardialSourceState:{
      coronaryBloodFlowMlPerMin:240,
      myocardialO2UseMlPerMin:24,
    },
  },
};

test('upstream runtime composes exactly nine myocardial acid-base inputs',()=>{
  const r=createV16MyocardialUpstreamRuntime({
    initialIcfvMl:20000,
    initialLeftHeartMassG:300,
    initialTissueWaterVolumeMl:40000,
    initialInterstitialWaterVolumeMl:12000,
    initialCellWaterVolumeMl:28000,
    initialEcfvMl:15000,
  });
  const s=r.step({
    dtSec:1,
    gasSnapshot,
    cardiopulmonarySnapshot,
    kPoolMassMeq:60,
    delayedAldosteroneEffect:1,
    interstitialWaterVolumeMl:12000,
    cellWaterVolumeMl:28000,
    ecfvMl:15000,
    tissueLactateOutflowsMeqPerMin:zeroOutflows(),
    ivDripLactateRateMeqPerMin:0,
    lactatePumpRateMeqPerMin:0,
    myocardialLactateUseMgPerMin:0,
  });
  assert.equal(Object.keys(s.myocardialAcidBaseInputs).length,9);
  assert.equal(s.myocardialAcidBaseInputs.bloodSidMolPerL,0.040);
  assert.equal(s.myocardialAcidBaseInputs.arterialHco3MolPerL,0.024);
  assert.equal(s.myocardialAcidBaseInputs.myocardialBloodFlowMlPerMin,240);
  assert.equal(s.myocardialAcidBaseInputs.myocardialO2UseMlPerMin,24);
  assert.equal(s.myocardialAcidBaseInputs.anaerobicGlucoseUseMgPerMin,0);
  assert(Number.isFinite(
    s.myocardialAcidBaseInputs.intracellularPotassiumMeqPerMl
  ));
  assert(Number.isFinite(
    s.myocardialAcidBaseInputs.leftVentricleLiquidVolumeMl
  ));
  assert(Number.isFinite(
    s.myocardialAcidBaseInputs.systemicLactatePoolMeqPerMl
  ));
});

test('myocardial lactate use remains explicit and is not defaulted',()=>{
  const r=createV16MyocardialUpstreamRuntime({
    initialIcfvMl:20000,
    initialLeftHeartMassG:300,
    initialTissueWaterVolumeMl:40000,
    initialInterstitialWaterVolumeMl:12000,
    initialCellWaterVolumeMl:28000,
    initialEcfvMl:15000,
  });
  assert.throws(()=>r.step({
    dtSec:1,
    gasSnapshot,
    cardiopulmonarySnapshot,
    kPoolMassMeq:60,
    delayedAldosteroneEffect:1,
    interstitialWaterVolumeMl:12000,
    cellWaterVolumeMl:28000,
    ecfvMl:15000,
    tissueLactateOutflowsMeqPerMin:zeroOutflows(),
    ivDripLactateRateMeqPerMin:0,
    lactatePumpRateMeqPerMin:0,
  }),/myocardialLactateUseMgPerMin/);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
