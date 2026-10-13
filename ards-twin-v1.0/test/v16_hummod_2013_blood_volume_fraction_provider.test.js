'use strict';
const assert=require('node:assert/strict');
const {bloodVolumeFractions2013}=require('../src/hummod_2013_blood_volume_fraction_provider.js');
let passed=0,failed=0;function test(n,f){try{f();console.log('ok -',n);passed++;}catch(e){console.error('FAIL -',n,':',e.message);failed++;}}
test('blood fractions reproduce HumMod definitions exactly',()=>{const s=bloodVolumeFractions2013({rbcVolumeMl:2200,plasmaVolumeMl:2800});assert.equal(s.bloodVolumeMl,5000);assert(Math.abs(s.hematocritFraction-0.44)<1e-12);assert(Math.abs(s.plasmaVolumeFraction-0.56)<1e-12);});
test('provider fails closed on zero total blood volume',()=>{assert.throws(()=>bloodVolumeFractions2013({rbcVolumeMl:0,plasmaVolumeMl:0}),/total blood volume/);});
console.log('\nTests: passed='+passed+' failed='+failed);process.exit(failed===0?0:1);