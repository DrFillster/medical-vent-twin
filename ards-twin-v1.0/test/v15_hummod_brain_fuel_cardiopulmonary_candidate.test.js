'use strict';

const assert=require('node:assert/strict');
const {
  P,
  brainMetabolismFromO2,
  brainFuelState,
  createHumModBrainFuelCandidate,
}=require('../src/hummod_brain_fuel_candidate.js');
const {
  createHumModCardiopulmonaryCompensationCandidate,
}=require('../src/hummod_cardiopulmonary_compensation_candidate.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}
function near(a,b,tol=1e-12){
  assert(Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b)),
    a+' not near '+b);
}

test('Brain-Metabolism constants remain exact HumMod source values',()=>{
  assert.equal(P.o2ToCal,4.778);
  assert.equal(P.carboAerobicMgPerCal,0.2439);
  assert.equal(P.carboAnaerobicMgPerCal,6.3411);
  assert.equal(P.fatMgPerCal,0.1075);
  assert.equal(P.lactateMgPerCal,0.2538);
  assert.equal(P.ketoacidRatioConstant,0.222);
  assert.equal(P.fractUseDelayKPerMin,0.5);
});

test('Brain-Metabolism O2 split reproduces source algebra',()=>{
  const s=brainMetabolismFromO2({
    o2NeedMlPerMin:40,
    o2UseMlPerMin:30,
  });
  near(s.o2LackMlPerMin,10);
  near(s.aerobicCalsPerMin,4.778*30);
  near(s.anaerobicCalsPerMin,4.778*10);
});

test('Brain-Fuel minimum fractional delivery is bounded and source ordered',()=>{
  const s=brainFuelState({
    plasmaFlowMlPerMin:400,
    glucoseMgPerMl:1.10,
    ketoacidMgPerMl:0.005,
    lactateMgPerDl:10,
    aerobicCalsPerMin:150,
    anaerobicCalsPerMin:50,
  });
  assert(s.minimumFractionalDelivery>=0);
  assert(s.minimumFractionalDelivery<=1);
  near(
    s.minimumFractionalDelivery,
    Math.min(
      s.kaFractionalDelivery,
      s.aerobicGlucoseFractionalDelivery,
      s.anaerobicGlucoseFractionalDelivery
    )
  );
});

test('Brain-Fuel StableDelay moves toward source FractUse without overshoot',()=>{
  const r=createHumModBrainFuelCandidate({initialFractUseDelay:1});
  const first=r.step({
    dtSec:1,
    plasmaFlowMlPerMin:200,
    glucoseMgPerMl:0.4,
    ketoacidMgPerMl:0.005,
    lactateMgPerDl:10,
    o2NeedMlPerMin:40,
    o2UseMlPerMin:5,
  });
  assert(first.fractUseDelay<=1);
  assert(first.fractUseDelay>=first.fuel.fractUse);
});

test('cardiopulmonary candidate exposes source chain with no control authority',()=>{
  const r=createHumModCardiopulmonaryCompensationCandidate({
    dtSec:0.1,
    ecfvMl:15000,
    initialCarotidPressureMmHg:97,
  });
  const s=r.step({
    arterialPo2MmHg:94.009870530838,
    arterialO2ContentMlPerMl:0.196,
    o2MaxMlPerMl:0.200216828201916,
    venousPh:7.37776997729073,
    venousPco2MmHg:44.8382538764693,
    carboxyPercent:0.389637710489589,
    tempC:37,
    cerebralPressureGradientMmHg:89.3625792967117,
    brainPco2MmHg:46.5805596402771,
    brainO2NeedMlPerMin:39.3065407483815,
    plasmaVolumeFraction:0.56,
    glucoseMgPerMl:1.10,
    ketoacidMgPerMl:0.005,
    brainLactateMgPerDl:10,
    carotidPressureMmHg:97,
  });
  assert.equal(s.authority,'candidate-not-canonical');
  assert.equal(s.canonicalControlAuthority,false);
  assert(Number.isFinite(s.brainFlow.o2UseMlPerMin));
  assert(Number.isFinite(s.brainFuel.fractUseDelay));
  assert(Number.isFinite(s.heartRatePerMin));
  assert.equal(s.limitations.controlAuthority,false);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
