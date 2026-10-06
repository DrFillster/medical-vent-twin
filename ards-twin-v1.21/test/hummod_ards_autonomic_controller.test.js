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


test('severe respiratory acidosis directly depresses myocardial contractility independent of catecholamine drive',()=>{
  const c=makeController();
  let s;
  for(let i=0;i<30;i++) s=c.step({
    dtSec:1, meanArterialPressureMmHg:82,
    thoracicPressureMmHg:0, arterialPo2MmHg:90,
    arterialPco2MmHg:100, arterialPh:7.10,
  });
  assert(s.acidoticContractilityMultiplier<=0.46 &&
    s.acidoticContractilityMultiplier>=0.44,
    'pH 7.10 respiratory acidosis should apply ~0.45 direct inotropy multiplier');
  assert(s.contractilityMultiplier>1,
    'sympathoadrenal controller may still be inotropically activated');
});

test('hypercapnic acidemia raises HR and pulmonary load while lowering systemic resistance',()=>{
  const c=makeController();
  let baseline;
  for(let i=0;i<30;i++) baseline=c.step({
    dtSec:1, meanArterialPressureMmHg:82,
    thoracicPressureMmHg:0, arterialPo2MmHg:90,
    arterialPco2MmHg:40, arterialPh:7.40,
  });
  let acidotic=baseline;
  for(let i=0;i<30;i++) acidotic=c.step({
    dtSec:1, meanArterialPressureMmHg:82,
    thoracicPressureMmHg:0, arterialPo2MmHg:90,
    arterialPco2MmHg:100, arterialPh:7.10,
  });
  assert(acidotic.hypercapnicAcidosisSeverity>0.99,'HCA severity should reach challenge anchor');
  assert(acidotic.heartRatePerMin>baseline.heartRatePerMin,'HR should rise with HCA');
  assert(acidotic.systemicArterialConductanceMlPerMinPerMmHg>
    baseline.systemicArterialConductanceMlPerMinPerMmHg,
    'systemic conductance should rise as SVR falls with HCA');
  assert(acidotic.pulmonaryArterialConductanceMultiplier<
    baseline.pulmonaryArterialConductanceMultiplier,
    'pulmonary conductance should fall as PVR rises with HCA');

  let milder=baseline;
  for(let i=0;i<30;i++) milder=c.step({
    dtSec:1, meanArterialPressureMmHg:82,
    thoracicPressureMmHg:0, arterialPo2MmHg:90,
    arterialPco2MmHg:60, arterialPh:7.25,
  });
  assert(milder.heartRatePerMin>baseline.heartRatePerMin,
    'HR should rise with milder HCA');
  assert(milder.systemicArterialConductanceMlPerMinPerMmHg>
    baseline.systemicArterialConductanceMlPerMinPerMmHg,
    'systemic conductance should already rise at milder HCA');
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
