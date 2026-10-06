'use strict';

const {
  CURVES,
  hermite,
  createHumModSourceAlignedAutonomicController,
} = require('../src/hummod_ards_autonomic_source_aligned.js');

let passed=0, failed=0;
function test(name,fn){try{fn();console.log('ok -',name);passed++;}catch(e){console.error('FAIL -',name,':',e.message);failed++;}}
function assertClose(actual,expected,tol=1e-9){
  if(!Number.isFinite(actual)||Math.abs(actual-expected)>tol) throw new Error('expected '+expected+', got '+actual);
}

test('HumMod FuelEffect source anchors are preserved',()=>{
  assertClose(hermite(CURVES.sympsCnsFuelEffect,0.30),0);
  assertClose(hermite(CURVES.sympsCnsFuelEffect,0.60),3);
  assertClose(hermite(CURVES.sympsCnsFuelEffect,0.80),0);
});

test('HumMod A2Effect source anchors are preserved',()=>{
  assertClose(hermite(CURVES.sympsCnsA2Effect,1.7),1);
  assertClose(hermite(CURVES.sympsCnsA2Effect,2.3),1.4);
});

test('v1.3 native-state hooks remain neutral when state is unavailable',()=>{
  const c=createHumModSourceAlignedAutonomicController();
  const s=c.step({dtSec:1,carotidPressureMmHg:55,averageAtrialTmpMmHg:2});
  assertClose(s.sympsCnsFuelEffect,0);
  assertClose(s.sympsCnsA2Effect,1);
  assertClose(s.sympsCnsNa,s.sympsCnsReflexNa);
});

test('FuelEffect and A2Effect alter SympsCNS only when explicit native inputs are supplied',()=>{
  const c=createHumModSourceAlignedAutonomicController();
  const s=c.step({
    dtSec:1,
    carotidPressureMmHg:55,
    averageAtrialTmpMmHg:2,
    brainFuelFractUseDelay:0.60,
    a2PoolLog10Conc:2.3,
  });
  assertClose(s.sympsCnsFuelEffect,3);
  assertClose(s.sympsCnsA2Effect,1.4);
  assertClose(s.sympsCnsNa,(s.sympsCnsReflexNa+3)*1.4,1e-8);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
