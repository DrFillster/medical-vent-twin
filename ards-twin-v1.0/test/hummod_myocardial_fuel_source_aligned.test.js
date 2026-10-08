'use strict';
const {
  KR,
  LAC_FRACTION_CURVE,
  hermite,
  myocardialFuelSelection,
}=require('../src/hummod_myocardial_fuel_source_aligned.js');

let passed=0,failed=0;
function test(name,fn){try{fn();console.log('ok -',name);passed++;}catch(e){console.error('FAIL -',name,':',e.message);failed++;}}
function assert(v,m){if(!v)throw new Error(m||'assertion failed');}
function near(a,b,tol=1e-12){assert(Math.abs(a-b)<=tol,a+' not near '+b);}

test('preserves HumMod KR and lactate fraction knots',()=>{
  near(KR,0.026);
  near(hermite(LAC_FRACTION_CURVE,10),0);
  near(hermite(LAC_FRACTION_CURVE,100),0.3);
});

test('delivery equals pool concentration times plasma flow',()=>{
  const s=myocardialFuelSelection({
    fattyAcidConcentrationMgPerMl:0.0016,
    fattyAcidConcentrationMgDl:0.16,
    glucoseConcentrationMgPerMl:0.011,
    glucoseConcentrationMgDl:1.10,
    plasmaFlowMlPerMin:100,
    myocardialLactateMgDl:10,
    aerobicCals:100,
    anaerobicCals:10,
  });
  near(s.faDelivered,0.16);
  near(s.glucoseDelivered,1.1);
});

test('fatty-acid/glucose split preserves source ratio equation',()=>{
  const s=myocardialFuelSelection({
    fattyAcidConcentrationMgPerMl:0.0016,
    fattyAcidConcentrationMgDl:0.16,
    glucoseConcentrationMgPerMl:0.011,
    glucoseConcentrationMgDl:1.10,
    plasmaFlowMlPerMin:100,
    myocardialLactateMgDl:10,
    aerobicCals:100,
    anaerobicCals:10,
  });
  const ratio=0.16/1.10;
  near(s.ratio,ratio);
  near(s.faFraction,ratio/(ratio+KR));
  near(s.glucoseFraction,1-s.faFraction);
});

test('lactate fraction reduces FA+glucose fraction',()=>{
  const a=myocardialFuelSelection({
    fattyAcidConcentrationMgPerMl:0.0016,fattyAcidConcentrationMgDl:0.16,
    glucoseConcentrationMgPerMl:0.011,glucoseConcentrationMgDl:1.10,
    plasmaFlowMlPerMin:100,myocardialLactateMgDl:10,aerobicCals:100,anaerobicCals:10,
  });
  const b=myocardialFuelSelection({
    fattyAcidConcentrationMgPerMl:0.0016,fattyAcidConcentrationMgDl:0.16,
    glucoseConcentrationMgPerMl:0.011,glucoseConcentrationMgDl:1.10,
    plasmaFlowMlPerMin:100,myocardialLactateMgDl:100,aerobicCals:100,anaerobicCals:10,
  });
  near(a.faGlucoseFraction,1);
  near(b.faGlucoseFraction,0.7);
  assert(b.lacUsedMgPerMin>a.lacUsedMgPerMin);
});

test('anaerobic glucose use is limited by delivered glucose after aerobic use',()=>{
  const s=myocardialFuelSelection({
    fattyAcidConcentrationMgPerMl:0.0016,fattyAcidConcentrationMgDl:0.16,
    glucoseConcentrationMgPerMl:0.001,glucoseConcentrationMgDl:0.10,
    plasmaFlowMlPerMin:10,myocardialLactateMgDl:10,aerobicCals:10,anaerobicCals:100,
  });
  near(s.anaerobicGlucoseUsedCalPerMin,s.anaerobicGlucoseDelivered);
});

test('minimum fractional delivery is source minimum across fuels',()=>{
  const s=myocardialFuelSelection({
    fattyAcidConcentrationMgPerMl:0.0016,fattyAcidConcentrationMgDl:0.16,
    glucoseConcentrationMgPerMl:0.011,glucoseConcentrationMgDl:1.10,
    plasmaFlowMlPerMin:100,myocardialLactateMgDl:50,aerobicCals:100,anaerobicCals:10,
  });
  near(s.minimumFractionalDelivery,Math.min(
    s.faFractionalDelivery,
    s.aerobicGlucoseFractionalDelivery,
    s.anaerobicGlucoseFractionalDelivery
  ));
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
