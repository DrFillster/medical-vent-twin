'use strict';

const {
  createHumModArdsDecompensationController,
  LOW_SVO2_SHOCK_MARKER_FRACTION,
  CARDIOVASCULAR_COLLAPSE_MAP_SEC,
  PROFOUND_COLLAPSE_MAP_SEC,
} = require('../src/hummod_ards_decompensation_controller.js');

let passed=0, failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}
function assert(c,m){if(!c)throw new Error(m||'assertion failed');}

test('stable physiology does not accumulate oxygen debt',()=>{
  const c=createHumModArdsDecompensationController();
  let s;
  for(let i=0;i<60;i++) s=c.step({
    dtSec:1,
    meanArterialPressureMmHg:82,
    mixedVenousO2SaturationFraction:0.70,
    requestedTissueO2UseMlPerMin:250,
    oxygenSupplyDeficitMlPerMin:0,
  });
  assert(s.stage==='stable','expected stable stage');
  assert(s.oxygenDebtMl===0,'oxygen debt should remain zero');
  assert(s.myocardialContractilityMultiplier===1,
    'contractility should remain normal');
  assert(s.alive===true,'patient should remain alive');
});

test('low mixed venous oxygen marks depleted compensatory reserve',()=>{
  const c=createHumModArdsDecompensationController();
  const s=c.step({
    dtSec:1,
    meanArterialPressureMmHg:70,
    mixedVenousO2SaturationFraction:LOW_SVO2_SHOCK_MARKER_FRACTION-0.01,
    requestedTissueO2UseMlPerMin:250,
    oxygenSupplyDeficitMlPerMin:0,
  });
  assert(s.stage==='compensated-shock',
    'low SvO2 should mark compensated shock before measured supply deficit');
});

test('persistent oxygen supply deficit accumulates debt and depresses myocardium',()=>{
  const c=createHumModArdsDecompensationController();
  let s;
  for(let i=0;i<20*60;i++) s=c.step({
    dtSec:1,
    meanArterialPressureMmHg:65,
    mixedVenousO2SaturationFraction:0.35,
    requestedTissueO2UseMlPerMin:250,
    oxygenSupplyDeficitMlPerMin:250,
  });
  assert(s.oxygenDebtMl>0,'oxygen debt should accumulate');
  assert(s.equivalentDebtMinutes>=19.9,
    'debt should represent approximately 20 equivalent minutes');
  assert(s.myocardialContractilityMultiplier<1,
    'persistent debt should depress contractility');
  assert(s.stage==='decompensated-shock',
    '20 equivalent minutes should reach decompensated shock');
  assert(s.alive===true,'decompensated shock is not yet arrest');
});

test('profound hypotension sustained for experimental collapse interval triggers arrest',()=>{
  const c=createHumModArdsDecompensationController();
  let s;
  for(let i=0;i<PROFOUND_COLLAPSE_MAP_SEC;i++) s=c.step({
    dtSec:1,
    meanArterialPressureMmHg:15,
    mixedVenousO2SaturationFraction:0.20,
    requestedTissueO2UseMlPerMin:250,
    oxygenSupplyDeficitMlPerMin:200,
  });
  assert(s.cardiacArrest===true,'MAP <20 for 10 sec should trigger arrest');
  assert(s.alive===false,'arrest should be terminal in reduced core');
  assert(s.stage==='cardiac-arrest','stage should be cardiac-arrest');
});

test('MAP below 30 for ten minutes triggers experimental cardiovascular collapse',()=>{
  const c=createHumModArdsDecompensationController();
  let s;
  for(let i=0;i<CARDIOVASCULAR_COLLAPSE_MAP_SEC;i++) s=c.step({
    dtSec:1,
    meanArterialPressureMmHg:25,
    mixedVenousO2SaturationFraction:0.25,
    requestedTissueO2UseMlPerMin:250,
    oxygenSupplyDeficitMlPerMin:150,
  });
  assert(s.cardiacArrest===true,'MAP <30 for 10 min should trigger arrest');
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
