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

test('baroreflex adaptation preserves HumMod 10-hour source time constant',()=>{
  const c=createHumModSourceAlignedAutonomicController();
  c.step({dtSec:1,carotidPressureMmHg:60});
  const s=c.snapshot();
  assert(s.adaptedPressureMmHg>96.99,'10-hour source adaptation should barely move after 1 sec');
});

test('falling atrial TMP activates HumMod low-pressure sympathetic reflex',()=>{
  const c=createHumModSourceAlignedAutonomicController();
  let baseline;
  for(let i=0;i<20;i++) baseline=c.step({
    dtSec:1,carotidPressureMmHg:97,averageAtrialTmpMmHg:6,
  });
  let low=baseline;
  for(let i=0;i<20;i++) low=c.step({
    dtSec:1,carotidPressureMmHg:97,averageAtrialTmpMmHg:2,
  });
  assert(low.lowPressureNa<baseline.lowPressureNa,
    'low-pressure receptor NA should fall when atrial TMP falls');
  assert(low.sympsCnsLowPressureEffect>baseline.sympsCnsLowPressureEffect,
    'HumMod low-pressure effect should increase sympathetic drive');
  assert(low.sympsCnsHz>baseline.sympsCnsHz,
    'sympathetic firing should rise with reduced atrial TMP');
  assert(low.heartRatePerMin>baseline.heartRatePerMin,
    'SA-node rate should rise through HumMod low-pressure reflex');
});


test('native Brain-Function <=0.1 branch suppresses normal reflex sympathetic drive',()=>{
  const intact=createHumModSourceAlignedAutonomicController();
  const failed=createHumModSourceAlignedAutonomicController();
  let a,b;
  for(let i=0;i<20;i++){
    a=intact.step({
      dtSec:1,carotidPressureMmHg:60,averageAtrialTmpMmHg:2,
      brainFunctionEffect:1,
    });
    b=failed.step({
      dtSec:1,carotidPressureMmHg:60,averageAtrialTmpMmHg:2,
      brainFunctionEffect:0.05,
    });
  }
  near(b.sympsCnsHz,1.5,1e-9);
  assert(b.sympsCnsHz<a.sympsCnsHz,
    'brain failure branch should remove normal baro/low-pressure reflex contribution');
  assert(b.heartRatePerMin<a.heartRatePerMin,
    'native SA-node rate should fall when Brain-Function crosses the source branch threshold');
});


test('SympsChemo defaults neutral and a supplied effect propagates through native autonomic cascade',()=>{
  const base=createHumModSourceAlignedAutonomicController({initialCarotidPressureMmHg:97});
  const stim=createHumModSourceAlignedAutonomicController({initialCarotidPressureMmHg:97});
  const a=base.step({
    dtSec:1,carotidPressureMmHg:97,averageAtrialTmpMmHg:6,
    humoralAlphaPoolEffect:1,humoralBetaPoolEffect:1,
    brainFunctionEffect:1,exerciseSympsTotalEffect:0,
  });
  const b=stim.step({
    dtSec:1,carotidPressureMmHg:97,averageAtrialTmpMmHg:6,
    humoralAlphaPoolEffect:1,humoralBetaPoolEffect:1,
    brainFunctionEffect:1,exerciseSympsTotalEffect:0,
    sympsChemoEffect:2,
  });
  near(a.sympsChemoEffect,1,1e-12);
  assert(b.sympsCnsReflexNa>a.sympsCnsReflexNa,'chemoreflex must enter at SympsCNS.ReflexNA');
  assert(b.sympsCnsHz>a.sympsCnsHz,'SympsCNS firing must rise upstream');
  assert(b.gangliaHz>a.gangliaHz,'ganglia firing must follow SympsCNS');
  assert(b.vagusHz<a.vagusHz,'vagal firing must withdraw through native curve');
  assert(b.saBetaActivity>a.saBetaActivity,'SA beta activity must rise through native receptor weighting');
  assert(b.heartRatePerMin>a.heartRatePerMin,'HR may rise only after upstream autonomic changes');
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
