'use strict';

const {
  evaluateLin2012SteadyState,
}=require('../src/lin_2012_steady_state_hr_candidate.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}
function assert(c,m){if(!c)throw new Error(m||'assertion failed');}

test('published Lin steady-state controller is finite at baseline',()=>{
  const s=evaluateLin2012SteadyState({
    meanArterialPressureMmHg:82,
    arterialPo2MmHg:90,
    arterialPco2MmHg:40,
  });
  [
    s.demandPressureMmHg,s.pressureErrorMmHg,s.sympatheticHz,
    s.parasympatheticHz,s.heartRatePerMin,
  ].forEach(v=>assert(Number.isFinite(v),'expected finite output'));
  assert(s.controlAuthority===false);
  assert(s.dynamicAuthority===false);
});


test('Lin baroreflex signs are source-consistent',()=>{
  const low=evaluateLin2012SteadyState({
    meanArterialPressureMmHg:70,
    arterialPo2MmHg:90,
    arterialPco2MmHg:40,
  });
  const high=evaluateLin2012SteadyState({
    meanArterialPressureMmHg:110,
    arterialPo2MmHg:90,
    arterialPco2MmHg:40,
  });
  assert(high.pressureErrorMmHg>low.pressureErrorMmHg,
    'Eq13 pressure error should increase with MAP at fixed demand pressure');
  assert(high.sympatheticHz<low.sympatheticHz,
    'higher MAP should reduce Lin sympathetic outflow');
  assert(high.parasympatheticHz>low.parasympatheticHz,
    'higher MAP should increase Lin parasympathetic outflow');
  assert(high.heartRatePerMin<low.heartRatePerMin,
    'higher MAP should reduce HR through the source baroreflex');
});

test('severe hypoxia/hypercapnia resets baroreflex operating point upward',()=>{
  const b=evaluateLin2012SteadyState({
    meanArterialPressureMmHg:104,
    arterialPo2MmHg:90,
    arterialPco2MmHg:40,
  });
  const s=evaluateLin2012SteadyState({
    meanArterialPressureMmHg:104,
    arterialPo2MmHg:35,
    arterialPco2MmHg:110,
  });
  assert(s.demandPressureMmHg>b.demandPressureMmHg+20,
    'Lin Eq30 should materially reset demand pressure upward');
  assert(s.sympatheticGainPercent>b.sympatheticGainPercent,
    'Lin Eq31 should increase sympathetic gain during hypercapnia');
});

test('exact Lin steady-state algebra does not reproduce high-MAP severe-gas bradycardia',()=>{
  const baseline=evaluateLin2012SteadyState({
    meanArterialPressureMmHg:82,
    arterialPo2MmHg:90,
    arterialPco2MmHg:40,
  });
  const severe=evaluateLin2012SteadyState({
    meanArterialPressureMmHg:104,
    arterialPo2MmHg:35,
    arterialPco2MmHg:110,
  });
  assert(severe.heartRatePerMin>baseline.heartRatePerMin,
    'published baro-chemoreflex interaction should raise HR in severe gas stress despite MAP 104');
  assert(severe.sympatheticHz>baseline.sympatheticHz,
    'severe gas stress should increase source sympathetic outflow');
});

const maps=[60,70,80,90,100,104,110];
const rows=maps.map(map=>{
  const normal=evaluateLin2012SteadyState({
    meanArterialPressureMmHg:map,
    arterialPo2MmHg:90,
    arterialPco2MmHg:40,
  });
  const severe=evaluateLin2012SteadyState({
    meanArterialPressureMmHg:map,
    arterialPo2MmHg:35,
    arterialPco2MmHg:110,
  });
  return {
    map,
    normalHr:normal.heartRatePerMin,
    severeHr:severe.heartRatePerMin,
    normalDemand:normal.demandPressureMmHg,
    severeDemand:severe.demandPressureMmHg,
    normalSna:normal.sympatheticHz,
    severeSna:severe.sympatheticHz,
    normalPna:normal.parasympatheticHz,
    severePna:severe.parasympatheticHz,
  };
});
console.log(JSON.stringify({rows},null,2));
console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
