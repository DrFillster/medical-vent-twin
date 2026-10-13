'use strict';

const assert=require('node:assert/strict');
const {
  REQUIRED_LIVE_METABOLIC,
  resolveLeftHeartFuel2013Live,
}=require('../src/v16_left_heart_fuel_live_bridge.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}

const cp={
  cardiovascular:{
    myocardialSourceState:{
      coronaryBloodFlowMlPerMin:240,
      myocardialO2UseMlPerMin:24,
    },
  },
};
const prior={
  myocardialLactateMeqPerMl:0.001,
};
const metabolic={
  plasmaVolumeFraction:0.55,
  insulinReceptorBoundFractionPercent:8,
  glucosePoolMgPerMl:1,
  fattyAcidPoolMgPerMl:0.005,
  myocardialMassG:300,
  initialMyocardialMassG:300,
  thyroidEffect:1,
  heatMetabolismCore:1,
  structureEffect:1,
};

test('fuel bridge derives myocardial lactate use from prior myocardial state and current source flow/O2',()=>{
  const s=resolveLeftHeartFuel2013Live({
    cardiopulmonarySnapshot:cp,
    previousMyocardialAcidBaseSnapshot:prior,
    metabolic,
    systemicLactatePoolMeqPerMl:0.0015,
  });
  assert(Number.isFinite(s.myocardialLactateUseMgPerMin));
  assert(s.myocardialLactateUseMgPerMin>=0);
  assert.equal(s.plasmaFlowMlPerMin,132);
  assert.equal(s.canonicalControlAuthority,false);
});

test('fuel bridge keeps all genuinely missing metabolic states explicit',()=>{
  assert.equal(REQUIRED_LIVE_METABOLIC.length,9);
  assert.throws(()=>resolveLeftHeartFuel2013Live({
    cardiopulmonarySnapshot:cp,
    previousMyocardialAcidBaseSnapshot:prior,
    metabolic:{plasmaVolumeFraction:0.55},
    systemicLactatePoolMeqPerMl:0.0015,
  }),/missing live LeftHeart-Fuel states/);
});

test('fuel bridge refuses missing prior myocardial lactate state',()=>{
  assert.throws(()=>resolveLeftHeartFuel2013Live({
    cardiopulmonarySnapshot:cp,
    previousMyocardialAcidBaseSnapshot:{},
    metabolic,
    systemicLactatePoolMeqPerMl:0.0015,
  }),/previousMyocardialAcidBaseSnapshot.myocardialLactateMeqPerMl/);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
