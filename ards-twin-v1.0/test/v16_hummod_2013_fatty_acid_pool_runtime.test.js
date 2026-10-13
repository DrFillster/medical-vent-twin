'use strict';
const assert=require('node:assert/strict');
const {createHumMod2013FattyAcidPoolRuntime}=require('../src/hummod_2013_fatty_acid_pool_runtime.js');
let passed=0,failed=0;function test(n,f){try{f();console.log('ok -',n);passed++;}catch(e){console.error('FAIL -',n,':',e.message);failed++;}}
const zeros={triglycerideHydrolysisFattyAcidRateMgPerMin:0,lipidDepositsReleaseMgPerMin:0,metabolismFattyAcidTotalBurnMgPerMin:0,lipidDepositsUptakeMgPerMin:0,liverKetoacidFattyAcidUseMgPerMin:0,faDecompositionMgPerMin:0};
test('fatty-acid pool preserves source initialization at zero net flux',()=>{const r=createHumMod2013FattyAcidPoolRuntime({initialEcfvMl:15000});const a=r.snapshot({ecfvMl:15000});const b=r.step({dtSec:60,ecfvMl:15000,rates:zeros});assert.equal(a.massMg,b.massMg);assert.equal(b.fattyAcidMgPerMl,0.160);});
test('fatty-acid pool fails closed on incomplete source flux set',()=>{const r=createHumMod2013FattyAcidPoolRuntime({initialEcfvMl:15000});assert.throws(()=>r.step({dtSec:1,ecfvMl:15000,rates:{}}),/missing FAPool source rates/);});
console.log('\nTests: passed='+passed+' failed='+failed);process.exit(failed===0?0:1);