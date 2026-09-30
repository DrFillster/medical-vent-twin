'use strict';

const {
  makeNativeHumModStepRequest,
  validateNativeHumModProvider,
  validateNativeHumModStepResponse,
  makeNativeHumModSessionDescriptor,
} = require('../src/native_hummod_provider_contract.js');

let passed=0,failed=0;
function test(name,fn){try{fn();console.log('ok -',name);passed++;}catch(e){console.error('FAIL -',name,':',e.message);failed++;}}
function assert(c,m){if(!c)throw new Error(m||'assertion failed');}

test('provider requires deterministic lifecycle surface',()=>{
  const p={createSession(){},stepSession(){},getSession(){},saveSession(){},restoreSession(){}};
  assert(validateNativeHumModProvider(p)===true);
});

test('step request carries lock-step expected model time and coupling inputs',()=>{
  const r=makeNativeHumModStepRequest({
    sessionId:'s1', expectedModelTimeSec:10, dtSec:1,
    coupling:{
      meanAirwayPressureCmH2O:12, pleuralPressureCmH2O:7,
      pericardialPressureMmHg:5, fio2:0.5,
      minuteVentilationLPerMin:8, alveolarVentilationLPerMin:5,
      recruitmentIndex:0.6, shuntFraction:0.2, deadSpaceFraction:0.35,
    },
  });
  assert(r.expectedModelTimeSec===10);
  assert(r.dtSec===1);
  assert(r.coupling.fio2===0.5);
});

test('session descriptor requires runtime identity',()=>{
  const s=makeNativeHumModSessionDescriptor({
    sessionId:'s1', hummodSourceRevision:'abc', serviceVersion:'2.0.0',
    capabilities:{deterministicStep:true,saveRestore:true},
  });
  assert(s.hummodSourceRevision==='abc');
  assert(s.capabilities.deterministicStep===true);
});

test('step response validates source and service identity',()=>{
  const x={
    schema:'vent-native-hummod-step/v2',
    sessionId:'s1', modelTimeSec:1,
    hummodSourceRevision:'abc', serviceVersion:'2.0.0',
    systemic:{heartRatePerMin:75},
  };
  assert(validateNativeHumModStepResponse(x)===true);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
