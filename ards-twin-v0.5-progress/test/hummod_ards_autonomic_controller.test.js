'use strict';

const { createHumModArdsAutonomicController } =
  require('../src/hummod_ards_autonomic_controller.js');

let passed=0, failed=0;
function test(name,fn){try{fn();console.log('ok -',name);passed++;}catch(e){console.error('FAIL -',name,':',e.message);failed++;}}
function assert(c,m){if(!c)throw new Error(m||'assertion failed');}

function makeController(){
  return createHumModArdsAutonomicController({
    baseline:{
      heartRatePerMin:75,
      systemicArterialConductanceMlPerMinPerMmHg:60,
      systemicVenousConductanceMlPerMinPerMmHg:692,
      systemicVenousV0Ml:1700,
      leftContractilityMultiplier:1,
    },
    targetMapMmHg:82,
  });
}

test('hypotension recruits coordinated sympathetic cardiovascular compensation',()=>{
  const c=makeController();
  let baseline;
  for(let i=0;i<20;i++) baseline=c.step({
    dtSec:1, meanArterialPressureMmHg:82,
    thoracicPressureMmHg:0, arterialPo2MmHg:90, arterialPco2MmHg:40,
  });
  let low=baseline;
  for(let i=0;i<20;i++) low=c.step({
    dtSec:1, meanArterialPressureMmHg:58,
    thoracicPressureMmHg:0, arterialPo2MmHg:90, arterialPco2MmHg:40,
  });
  assert(low.sympatheticTone>baseline.sympatheticTone,'sympathetic tone should rise');
  assert(low.catecholamineDrive>baseline.catecholamineDrive,'catecholamine drive should rise');
  assert(low.heartRatePerMin>baseline.heartRatePerMin,'HR should rise under isolated hypotensive challenge');
  assert(low.contractilityMultiplier>baseline.contractilityMultiplier,'contractility should rise');
  assert(low.systemicArterialConductanceMlPerMinPerMmHg<
    baseline.systemicArterialConductanceMlPerMinPerMmHg,
    'arterial conductance should fall as SVR rises');
  assert(low.systemicVenousV0Ml<baseline.systemicVenousV0Ml,
    'venoconstriction should recruit unstressed venous volume');
});

test('positive thoracic pressure and hypoxemia increase modeled pulmonary vascular load',()=>{
  const c=makeController();
  let normal;
  for(let i=0;i<15;i++) normal=c.step({
    dtSec:1, meanArterialPressureMmHg:82,
    thoracicPressureMmHg:0, arterialPo2MmHg:90, arterialPco2MmHg:40,
  });
  let stressed=normal;
  for(let i=0;i<15;i++) stressed=c.step({
    dtSec:1, meanArterialPressureMmHg:82,
    thoracicPressureMmHg:8, arterialPo2MmHg:55, arterialPco2MmHg:40,
  });
  assert(stressed.pulmonaryArterialConductanceMultiplier<
    normal.pulmonaryArterialConductanceMultiplier,
    'pulmonary conductance should fall with pressure/hypoxic load');
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
