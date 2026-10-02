'use strict';

const {
  CURVES,
  SOURCE_CONSTANTS,
  hermite,
  receptorActivity,
  createHumModSourceAlignedAutonomicController,
}=require('../src/hummod_ards_autonomic_source_aligned.js');

let passed=0,failed=0;
function test(name,fn){try{fn();console.log('ok -',name);passed++;}catch(e){console.error('FAIL -',name,':',e.message);failed++;}}
function assert(c,m){if(!c)throw new Error(m||'assertion failed');}
function near(a,b,tol=1e-6){assert(Math.abs(a-b)<=tol, a+' not near '+b);}

test('HumMod source curve knots are preserved',()=>{
  near(hermite(CURVES.baroreflexPressureEffect,0),1);
  near(hermite(CURVES.sympsCnsBaroEffect,1),1);
  near(hermite(CURVES.vagusHz,1.5),2);
  near(hermite(CURVES.saParasympatheticEffect,2),-20);
  near(hermite(CURVES.saSympatheticEffect,1),10);
  near(hermite(CURVES.systemicVeinsV0AlphaEffect,1),1);
});

test('source receptor weighting normalizes near one at resting neural/humoral activity',()=>{
  const activity=receptorActivity({gangliaHz:1.5,humoralPoolEffect:1});
  near(activity,0.9995,1e-9);
});

test('resting source-aligned state produces physiologic sinus rate and near-baseline inotropy/V0',()=>{
  const c=createHumModSourceAlignedAutonomicController();
  let s;
  for(let i=0;i<30;i++) s=c.step({dtSec:1,carotidPressureMmHg:97});
  assert(s.heartRatePerMin>65&&s.heartRatePerMin<80,'resting HR should be near source baseline');
  assert(s.contractilityMultiplier>0.95&&s.contractilityMultiplier<1.05,'contractility should normalize near 1');
  assert(s.systemicVenousV0Ml>1650&&s.systemicVenousV0Ml<1750,'venous V0 should normalize near 1700 mL');
});

test('acute carotid pressure fall produces source-direction tachycardia inotropy and venoconstriction',()=>{
  const c=createHumModSourceAlignedAutonomicController();
  let baseline;
  for(let i=0;i<30;i++) baseline=c.step({dtSec:1,carotidPressureMmHg:97});
  let low=baseline;
  for(let i=0;i<20;i++) low=c.step({dtSec:1,carotidPressureMmHg:60});
  assert(low.sympsCnsHz>baseline.sympsCnsHz,'sympathetic firing should rise');
  assert(low.vagusHz<baseline.vagusHz,'vagal firing should fall');
  assert(low.heartRatePerMin>baseline.heartRatePerMin,'HR should rise');
  assert(low.contractilityMultiplier>baseline.contractilityMultiplier,'beta inotropy should rise');
  assert(low.systemicVenousV0Ml<baseline.systemicVenousV0Ml,'venous V0 should fall');
});

test('baroreflex adaptation is slow on acute ventilator timescale',()=>{
  const c=createHumModSourceAlignedAutonomicController();
  c.step({dtSec:1,carotidPressureMmHg:60});
  const s=c.snapshot();
  assert(s.adaptedPressureMmHg>96.8,'10-minute source adaptation should move only slightly after 1 sec');
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
