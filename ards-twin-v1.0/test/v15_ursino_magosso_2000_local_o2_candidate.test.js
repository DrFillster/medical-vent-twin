'use strict';

const assert=require('node:assert/strict');
const {
  LOCAL,
  localO2Target,
  resistanceFromLocalO2,
  createUrsinoMagosso2000LocalO2Candidate,
}=require('../src/ursino_magosso_2000_local_o2_candidate.js');
const {
  P:O2_P,
  arterialO2ConcentrationMlO2PerMlBlood,
}=require('../src/ursino_magosso_2000_oxygen_metabolic_candidate.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}
function close(a,b,tol=1e-10){
  return Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b));
}

test('Eq 41 target is zero at source-normal venous O2',()=>{
  for(const bed of ['brain','heart','muscle']){
    assert(close(localO2Target({
      venousO2MlPerMl:LOCAL[bed].normalVenousO2MlPerMl,
      normalVenousO2MlPerMl:LOCAL[bed].normalVenousO2MlPerMl,
      gain:LOCAL[bed].gain,
    }),0));
  }
});

test('falling venous O2 increases local state and lowers resistance',()=>{
  const target=localO2Target({
    venousO2MlPerMl:0.10,
    normalVenousO2MlPerMl:LOCAL.brain.normalVenousO2MlPerMl,
    gain:LOCAL.brain.gain,
  });
  assert(target>0);
  const r=resistanceFromLocalO2({
    normalResistanceMmHgSecPerMl:LOCAL.brain.normalResistanceMmHgSecPerMl,
    localState:target,
  });
  assert(r<LOCAL.brain.normalResistanceMmHgSecPerMl);
});

test('skeletal muscle local O2 effect multiplies the supplied reflex-normal resistance',()=>{
  const x=0.5;
  const lowNormal=resistanceFromLocalO2({
    normalResistanceMmHgSecPerMl:4,
    localState:x,
  });
  const highNormal=resistanceFromLocalO2({
    normalResistanceMmHgSecPerMl:8,
    localState:x,
  });
  assert(close(highNormal/lowNormal,2));
});

test('source-normal venous concentrations remain a fixed point when flows satisfy Eq 43',()=>{
  const c=createUrsinoMagosso2000LocalO2Candidate();
  const ca=arterialO2ConcentrationMlO2PerMlBlood({
    pao2MmHg:95,paco2MmHg:40,
  });
  const flows={
    brain:O2_P.metabolism.brainO2ConsumptionMlPerSec/
      (ca-LOCAL.brain.normalVenousO2MlPerMl),
    heart:O2_P.metabolism.heartBasalO2ConsumptionMlPerSec/
      (ca-LOCAL.heart.normalVenousO2MlPerMl),
    muscle:O2_P.metabolism.muscleO2ConsumptionMlPerSec/
      (ca-LOCAL.muscle.normalVenousO2MlPerMl),
  };
  let s;
  for(let i=0;i<100;i++){
    s=c.step({
      dtSec:0.1,pao2MmHg:95,paco2MmHg:40,
      brainFlowMlPerSec:flows.brain,
      coronaryFlowMlPerSec:flows.heart,
      muscleFlowMlPerSec:flows.muscle,
      muscleNormalResistanceMmHgSecPerMl:4.48,
      averageCardiacPumpPowerMmHgMlPerSec:
        O2_P.metabolism.heartBasalPowerMmHgMlPerSec,
    });
  }
  assert(Math.abs(s.localState.brain)<1e-8);
  assert(Math.abs(s.localState.heart)<1e-8);
  assert(Math.abs(s.localState.muscle)<1e-8);
});

test('deep isocapnic hypoxia drives local vasodilation at fixed basal flows',()=>{
  const c=createUrsinoMagosso2000LocalO2Candidate();
  const ca=arterialO2ConcentrationMlO2PerMlBlood({
    pao2MmHg:95,paco2MmHg:40,
  });
  const flows={
    brain:O2_P.metabolism.brainO2ConsumptionMlPerSec/
      (ca-LOCAL.brain.normalVenousO2MlPerMl),
    heart:O2_P.metabolism.heartBasalO2ConsumptionMlPerSec/
      (ca-LOCAL.heart.normalVenousO2MlPerMl),
    muscle:O2_P.metabolism.muscleO2ConsumptionMlPerSec/
      (ca-LOCAL.muscle.normalVenousO2MlPerMl),
  };
  let s;
  for(let i=0;i<200;i++){
    s=c.step({
      dtSec:0.1,pao2MmHg:28,paco2MmHg:40,
      brainFlowMlPerSec:flows.brain,
      coronaryFlowMlPerSec:flows.heart,
      muscleFlowMlPerSec:flows.muscle,
      muscleNormalResistanceMmHgSecPerMl:4.48,
      averageCardiacPumpPowerMmHgMlPerSec:
        O2_P.metabolism.heartBasalPowerMmHgMlPerSec,
    });
  }
  assert(s.resistanceMmHgSecPerMl.brain<LOCAL.brain.normalResistanceMmHgSecPerMl);
  assert(s.resistanceMmHgSecPerMl.heart<LOCAL.heart.normalResistanceMmHgSecPerMl);
  assert(s.resistanceMmHgSecPerMl.muscle<4.48);
  assert.equal(s.authority,'candidate-not-canonical');
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
