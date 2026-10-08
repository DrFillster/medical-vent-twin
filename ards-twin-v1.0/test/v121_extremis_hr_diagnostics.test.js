'use strict';

const {
  createHumModSourceAlignedAutonomicController,
} = require('../src/hummod_ards_autonomic_source_aligned.js');

let passed=0, failed=0;
function test(name,fn){try{fn();console.log('ok -',name);passed++;}catch(e){console.error('FAIL -',name,':',e.message);failed++;}}
function assert(x,m){if(!x)throw new Error(m||'assertion failed');}

test('v1.21 autonomic snapshot exposes complete diagnostic chain used for HR',()=>{
  const c=createHumModSourceAlignedAutonomicController();
  const s=c.step({
    dtSec:1,
    carotidPressureMmHg:55,
    averageAtrialTmpMmHg:2,
    humoralAlphaPoolEffect:1.1,
    humoralBetaPoolEffect:1.1,
  });
  [
    'carotidPressureMmHg','adaptedPressureMmHg','pressureChangeMmHg','baroreflexNa',
    'averageAtrialTmpMmHg','lowPressureNa','sympsCnsBaroEffect',
    'sympsCnsLowPressureEffect','sympsCnsReflexNa','sympsCnsNa','sympsCnsHz',
    'vagusHz','saBetaActivity','parasympatheticEffectPerMin',
    'sympatheticEffectPerMin','heartRatePerMin','humoralBetaPoolEffect'
  ].forEach(k=>assert(Number.isFinite(s[k]),k+' must be finite'));
  assert(Array.isArray(s.provenance.neutralizedDependencies),'neutralized dependency list missing');
  assert(s.provenance.neutralizedDependencies.some(x=>x.includes('Brain-Fuel')),
    'Brain-Fuel upstream limitation must remain explicit');
  assert(s.provenance.neutralizedDependencies.some(x=>x.includes('Brain-Function')),
    'standalone controller must declare Brain-Function boundary when not supplied');
  assert(s.provenance.neutralizedDependencies.some(x=>x.includes('A2Pool')),
    'A2Pool upstream limitation must remain explicit');
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
