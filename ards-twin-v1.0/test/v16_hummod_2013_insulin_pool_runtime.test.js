'use strict';
const assert=require('node:assert/strict');
const {createHumMod2013InsulinPoolRuntime}=require('../src/hummod_2013_insulin_pool_runtime.js');
let p=0,f=0;function test(n,fn){try{fn();console.log('ok -',n);p++;}catch(e){console.error('FAIL -',n,':',e.message);f++;}}
const z={insulinSecretionRatePerMin:0,insulinPumpRatePerMin:0,insulinInjectionAbsorbRatePerMin:0,generalReceptorUnbindingRatePerMin:0,liverReceptorUnbindingRatePerMin:0,insulinClearanceRatePerMin:0};
test('InsulinPool initializes at source target concentration',()=>{const r=createHumMod2013InsulinPoolRuntime({initialEcfvMl:15000});assert.equal(r.snapshot({ecfvMl:15000}).insulinSourceConcentration,20);});
test('InsulinPool fails closed on missing rates',()=>{const r=createHumMod2013InsulinPoolRuntime({initialEcfvMl:15000});assert.throws(()=>r.step({dtSec:1,ecfvMl:15000,rates:{}}),/missing InsulinPool source rates/);});
test('zero net source flux preserves mass',()=>{const r=createHumMod2013InsulinPoolRuntime({initialEcfvMl:15000});const a=r.snapshot({ecfvMl:15000});const b=r.step({dtSec:60,ecfvMl:15000,rates:z});assert.equal(a.mass,b.mass);});
console.log('\nTests: passed='+p+' failed='+f);process.exit(f===0?0:1);