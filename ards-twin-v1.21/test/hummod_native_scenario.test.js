'use strict';
const { validateNativeHumModScenario }=require('../src/hummod_native_scenario.js');
let passed=0,failed=0;
function test(n,f){try{f();console.log('ok -',n);passed++;}catch(e){console.error('FAIL -',n,':',e.message);failed++;}}
function assert(v,m){if(!v)throw new Error(m||'assertion failed');}
function base(assignments={'Ventilator.Switch':1}){return {schema:'vent-hummod-native-scenario/v1',id:'x',scenarioClass:'engineering-transport-probe',assignments,provenance:{clinicalValidation:false}};}
test('accepts source-verified assignment',()=>assert(validateNativeHumModScenario(base())));
test('rejects arbitrary HumMod state mutation',()=>{let ok=false;try{validateNativeHumModScenario(base({'SystemicArtys.Pressure':20}));}catch(e){ok=/unapproved/.test(e.message)}assert(ok);});
test('rejects invalid ventilator switch',()=>{let ok=false;try{validateNativeHumModScenario(base({'Ventilator.Switch':2}));}catch(e){ok=/0 or 1/.test(e.message)}assert(ok);});
test('rejects negative injury parameter',()=>{let ok=false;try{validateNativeHumModScenario(base({'ExcessLungWater.Volume':-1}));}catch(e){ok=/non-negative/.test(e.message)}assert(ok);});
test('requires explicit clinical-validation provenance',()=>{const s=base();delete s.provenance.clinicalValidation;let ok=false;try{validateNativeHumModScenario(s);}catch(e){ok=/clinicalValidation/.test(e.message)}assert(ok);});
console.log('Tests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
