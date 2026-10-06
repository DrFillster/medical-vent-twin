'use strict';

const { createHumModArdsCirculation } = require('../src/hummod_ards_core_circulation.js');

let passed=0, failed=0;
function test(name,fn){try{fn();console.log('ok -',name);passed++;}catch(e){console.error('FAIL -',name,':',e.message);failed++;}}
function assert(c,m){if(!c)throw new Error(m||'assertion failed');}
function total(v){return Object.values(v).reduce((a,b)=>a+b,0);}

function makeRuntime(){
  return createHumModArdsCirculation({
    initialVolumesMl:{
      systemicArteries:999,
      systemicVeins:2675,
      rightAtrium:51,
      pulmonaryArtery:201,
      pulmonaryCapillaries:200,
      pulmonaryVeins:211,
      leftAtrium:51,
    },
    boundaries:{
      heartRatePerMin:75,
      systemicArterialConductanceMlPerMinPerMmHg:60,
      systemicVenousConductanceMlPerMinPerMmHg:692,
      rightContractilityMultiplier:1,
      leftContractilityMultiplier:1,
      rightStiffnessMultiplier:1,
      leftStiffnessMultiplier:1,
    },
    maxSubstepSec:0.005,
  });
}

test('reduced circulation conserves total vascular volume',()=>{
  const rt=makeRuntime();
  const before=total(rt.snapshot().volumesMl);
  const afterSnap=rt.step({
    dtSec:0.05,
    thoracicPressureMmHg:0,
    pericardialPressureMmHg:0,
  });
  const after=total(afterSnap.volumesMl);
  assert(Math.abs(after-before)<1e-8,'volume conservation failed');
});

test('source-aligned circulation produces finite pressures and flows',()=>{
  const rt=makeRuntime();
  const s=rt.step({
    dtSec:0.01,
    thoracicPressureMmHg:0,
    pericardialPressureMmHg:0,
  });
  for(const v of Object.values(s.pressures)) assert(Number.isFinite(v));
  for(const v of Object.values(s.flowsMlPerMin)) assert(Number.isFinite(v));
  assert(s.flowsMlPerMin.leftVentricular>0);
  assert(s.flowsMlPerMin.rightVentricular>0);
});

test('raising thoracic/pericardial pressure changes right-heart loading',()=>{
  const a=makeRuntime().step({
    dtSec:0.01,
    thoracicPressureMmHg:0,
    pericardialPressureMmHg:0,
  });
  const b=makeRuntime().step({
    dtSec:0.01,
    thoracicPressureMmHg:3,
    pericardialPressureMmHg:3,
  });
  assert(b.pressures.pulmonaryArteryMmHg>a.pressures.pulmonaryArteryMmHg);
  assert(b.pressures.rightAtrialMmHg>a.pressures.rightAtrialMmHg);
  assert(Number.isFinite(b.rightVentricle.bloodFlowMlPerMin));
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
