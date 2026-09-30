'use strict';

const {
  createHumModSourceAlignedAutonomicController,
} = require('../src/hummod_ards_autonomic_source_aligned.js');
const {
  createHumModArdsAutonomicController,
} = require('../src/hummod_ards_autonomic_controller.js');

let passed=0,failed=0;
function test(name,fn){try{fn();console.log('ok -',name);passed++;}catch(e){console.error('FAIL -',name,':',e.message);failed++;}}
function assert(c,m){if(!c)throw new Error(m||'assertion failed');}

function makeLegacy(){
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

function makeSource(){
  return createHumModSourceAlignedAutonomicController({
    initialCarotidPressureMmHg:97,
    systemicVenousV0BasicMl:1700,
  });
}

test('both controllers compensate in the correct direction during hypotension',()=>{
  const legacy=makeLegacy(), source=makeSource();
  let l0,s0,l1,s1;
  for(let i=0;i<30;i++){
    l0=legacy.step({
      dtSec:1,meanArterialPressureMmHg:82,thoracicPressureMmHg:0,
      arterialPo2MmHg:90,arterialPco2MmHg:40,arterialPh:7.40,
    });
    s0=source.step({dtSec:1,carotidPressureMmHg:97});
  }
  for(let i=0;i<20;i++){
    l1=legacy.step({
      dtSec:1,meanArterialPressureMmHg:60,thoracicPressureMmHg:0,
      arterialPo2MmHg:90,arterialPco2MmHg:40,arterialPh:7.40,
    });
    s1=source.step({dtSec:1,carotidPressureMmHg:60});
  }
  assert(l1.heartRatePerMin>l0.heartRatePerMin,'legacy HR should rise');
  assert(s1.heartRatePerMin>s0.heartRatePerMin,'source-aligned HR should rise');
  assert(l1.contractilityMultiplier>l0.contractilityMultiplier,'legacy contractility should rise');
  assert(s1.contractilityMultiplier>s0.contractilityMultiplier,'source contractility should rise');
  assert(l1.systemicVenousV0Ml<l0.systemicVenousV0Ml,'legacy venous V0 should fall');
  assert(s1.systemicVenousV0Ml<s0.systemicVenousV0Ml,'source venous V0 should fall');
});

test('source-aligned pathway is not numerically identical to legacy engineering controller',()=>{
  const legacy=makeLegacy(), source=makeSource();
  let l,s;
  for(let i=0;i<20;i++){
    l=legacy.step({
      dtSec:1,meanArterialPressureMmHg:60,thoracicPressureMmHg:0,
      arterialPo2MmHg:90,arterialPco2MmHg:40,arterialPh:7.40,
    });
    s=source.step({dtSec:1,carotidPressureMmHg:60});
  }
  assert(Math.abs(l.heartRatePerMin-s.heartRatePerMin)>0.5,
    'source-aligned HR should reflect a distinct source pathway');
  assert(Math.abs(l.systemicVenousV0Ml-s.systemicVenousV0Ml)>1,
    'source-aligned venous V0 should reflect a distinct source pathway');
});

test('source-aligned subset exposes exact HumMod source identity',()=>{
  const s=makeSource().step({dtSec:1,carotidPressureMmHg:97});
  assert(s.provenance.sourceRepository==='riliescu/hummod-standalone');
  assert(s.provenance.sourceRevision==='8dab57e05631f779bf5020fe0dd51874d8ae98c1');
  assert(s.provenance.status==='source-aligned-acute-subset');
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
