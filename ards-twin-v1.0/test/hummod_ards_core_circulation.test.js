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


test('source blood-volume mode makes systemic veins the residual compartment',()=>{
  const initialVolumes={
    systemicArteries:999,
    systemicVeins:2675,
    rightAtrium:51,
    pulmonaryArtery:201,
    pulmonaryCapillaries:200,
    pulmonaryVeins:211,
    leftAtrium:51,
  };
  const modeledTotal=Object.values(initialVolumes).reduce((a,b)=>a+b,0);
  const bloodVolumeMl=5400;
  const residual=bloodVolumeMl-modeledTotal;
  const rt=createHumModArdsCirculation({
    initialVolumesMl:initialVolumes,
    boundaries:{
      heartRatePerMin:75,
      systemicArterialConductanceMlPerMinPerMmHg:60,
      systemicVenousConductanceMlPerMinPerMmHg:692,
      rightContractilityMultiplier:1,
      leftContractilityMultiplier:1,
      bloodVolumeMl,
      unmodeledVascularVolumeMl:residual,
    },
    maxSubstepSec:0.005,
  });
  rt.setBoundaries({bloodVolumeMl:5300});
  const s=rt.step({
    dtSec:0.01,
    thoracicPressureMmHg:0,
    pericardialPressureMmHg:0,
  });
  const represented=Object.values(s.volumesMl).reduce((a,b)=>a+b,0);
  assert(Math.abs((represented+residual)-5300)<1e-6,'source blood-volume residual constraint failed');
  assert(s.provenance.bloodVolumeConstraint!=='disabled');
});


test('explicit organ outflow mode fails closed without a complete network',()=>{
  const rt=makeRuntime();
  rt.setBoundaries({systemicOutflowMode:'explicit-organ-network'});
  let threw=false;
  try{
    rt.step({dtSec:0.01,thoracicPressureMmHg:0,pericardialPressureMmHg:0});
  }catch(e){threw=/complete explicitSystemicOutflow/.test(e.message);}
  assert(threw,'expected explicit organ mode to refuse incomplete network');
});

test('explicit organ outflow mode uses supplied complete HumMod outflow',()=>{
  const rt=makeRuntime();
  rt.setBoundaries({
    systemicOutflowMode:'explicit-organ-network',
    explicitSystemicOutflow:Object.freeze({
      complete:true,
      systemicArterialOutflowMlPerMin:4321,
      provenance:Object.freeze({status:'test-complete-network'}),
    }),
  });
  const s=rt.step({dtSec:0.005,thoracicPressureMmHg:0,pericardialPressureMmHg:0});
  assert(Math.abs(s.flowsMlPerMin.systemicOutflow-4321)<1e-9);
  assert(s.systemicOutflowAuthority==='HumMod explicit organ-flow network');
  assert(s.provenance.systemicOutflowMode==='explicit-organ-network');
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
