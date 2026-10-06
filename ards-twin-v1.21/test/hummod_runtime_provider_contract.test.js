'use strict';
const {
  validateHumModRuntimeProvider,
  makeHumModRuntimeStepRequest,
  makeHumModRuntimeDescriptor,
}=require('../src/hummod_runtime_provider_contract.js');

let passed=0,failed=0;
function test(name,fn){try{fn();console.log('ok -',name);passed++;}catch(e){console.error('FAIL -',name,':',e.message);failed++;}}
function assert(c,m){if(!c)throw new Error(m||'assertion failed');}

test('provider lifecycle is explicit',()=>{
  assert(validateHumModRuntimeProvider({createSession(){},stepSession(){},getSession(){},saveSession(){},restoreSession(){}}));
});

test('step request carries lock-step expected model time',()=>{
  const r=makeHumModRuntimeStepRequest({sessionId:'s1',expectedModelTimeSec:4,dtSec:1,coupling:{meanAirwayPressureCmH2O:12}});
  assert(r.expectedModelTimeSec===4&&r.dtSec===1);
});

test('descriptor identifies source and implementation separately',()=>{
  const d=makeHumModRuntimeDescriptor({
    sessionId:'s1',sourceRepository:'riliescu/hummod-standalone',
    sourceRevision:'8dab57e05631f779bf5020fe0dd51874d8ae98c1',
    runtimeVersion:'0.1.0',implementation:'des-interpreter',
    capabilities:{deterministicStep:true}
  });
  assert(d.implementation==='des-interpreter');
  assert(d.capabilities.deterministicStep===true);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
