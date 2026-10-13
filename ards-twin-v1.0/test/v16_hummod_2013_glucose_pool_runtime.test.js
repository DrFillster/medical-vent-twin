'use strict';
const assert=require('node:assert/strict');
const {createHumMod2013GlucosePoolRuntime}=require('../src/hummod_2013_glucose_pool_runtime.js');
let passed=0,failed=0;function test(n,f){try{f();console.log('ok -',n);passed++;}catch(e){console.error('FAIL -',n,':',e.message);failed++;}}
const zeros={giCarbohydrateAbsorptionMgPerMin:0,liverGlucoseReleaseMgPerMin:0,glucosePumpRateMgPerMin:0,metabolismGlucoseTotalUptakeMgPerMin:0,liverGlucoseUptakeMgPerMin:0,nephronGlucoseSpilloverMgPerMin:0,glucoseDecompositionMgPerMin:0};
test('glucose pool preserves mass at zero net flux',()=>{const r=createHumMod2013GlucosePoolRuntime({initialMassMg:15000});const a=r.snapshot({ecfvMl:15000});const b=r.step({dtSec:60,ecfvMl:15000,rates:zeros});assert.equal(a.massMg,b.massMg);assert.equal(b.glucoseMgPerMl,1);});
test('glucose pool fails closed on incomplete source flux set',()=>{const r=createHumMod2013GlucosePoolRuntime({initialMassMg:15000});assert.throws(()=>r.step({dtSec:1,ecfvMl:15000,rates:{}}),/missing GlucosePool source rates/);});
console.log('\nTests: passed='+passed+' failed='+failed);process.exit(failed===0?0:1);