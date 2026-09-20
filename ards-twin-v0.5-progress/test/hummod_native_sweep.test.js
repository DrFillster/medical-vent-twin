'use strict';
const {validateNativeHumModSweep}=require('../src/hummod_native_sweep.js');
let passed=0,failed=0;
function test(n,f){try{f();console.log('ok -',n);passed++;}catch(e){console.error('FAIL -',n,':',e.message);failed++;}}
function assert(v,m){if(!v)throw new Error(m||'assertion failed');}
function valid(){return {schema:'vent-hummod-native-sweep/v1',id:'s',clinicalValidation:false,baseline:{assignments:{'Ventilator.Switch':1,'Ventilator.Rate':16,'Ventilator.TidalVolume':450}},cases:[{id:'water',mechanism:'water',assignments:{'Ventilator.Switch':1,'Ventilator.Rate':16,'Ventilator.TidalVolume':450,'ExcessLungWater.Volume':250}}],provenance:{berlinArdsCalibration:false}};}
test('accepts controlled engineering sweep',()=>assert(validateNativeHumModSweep(valid())));
test('rejects changed ventilator between cases',()=>{const s=valid();s.cases[0].assignments['Ventilator.Rate']=20;let ok=false;try{validateNativeHumModSweep(s)}catch(e){ok=/preserve baseline/.test(e.message)}assert(ok);});
test('rejects duplicate case ids',()=>{const s=valid();s.cases.push({...s.cases[0]});let ok=false;try{validateNativeHumModSweep(s)}catch(e){ok=/duplicate/.test(e.message)}assert(ok);});
test('rejects case without injury perturbation',()=>{const s=valid();s.cases[0].assignments={...s.baseline.assignments};let ok=false;try{validateNativeHumModSweep(s)}catch(e){ok=/no pulmonary/.test(e.message)}assert(ok);});
test('rejects Berlin calibration claim',()=>{const s=valid();s.provenance.berlinArdsCalibration=true;let ok=false;try{validateNativeHumModSweep(s)}catch(e){ok=/berlinArdsCalibration=false/.test(e.message)}assert(ok);});
console.log('Tests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
