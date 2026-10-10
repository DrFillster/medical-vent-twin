'use strict';
const assert=require('node:assert/strict');
const {P,baroreceptorStatic,createUrsinoBaroreceptorShadow}=
  require('../src/ursino_baroreceptor_shadow.js');

function approx(a,b,t){assert.ok(Math.abs(a-b)<=t,`expected ${b}, got ${a}`);}

approx(baroreceptorStatic(P.pressureMidMmHg),
  (P.fMinSpikesPerSec+P.fMaxSpikesPerSec)/2,1e-12);
assert.ok(baroreceptorStatic(150)>baroreceptorStatic(92));
assert.ok(baroreceptorStatic(50)<baroreceptorStatic(92));

const shadow=createUrsinoBaroreceptorShadow();
const s0=shadow.step({dtSec:1,arterialPressureMmHg:92});
assert.ok(Number.isFinite(s0.fAbSpikesPerSec));
assert.equal(s0.authority,'shadow-diagnostic-only');
const s1=shadow.step({dtSec:1,arterialPressureMmHg:70});
assert.ok(s1.fAbSpikesPerSec<s0.fAbSpikesPerSec);
console.log('ok - Ursino baroreceptor shadow');
