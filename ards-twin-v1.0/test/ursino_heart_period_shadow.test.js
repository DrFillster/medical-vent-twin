'use strict';
const assert=require('node:assert/strict');
const {createUrsinoHeartPeriodShadow}=
  require('../src/ursino_heart_period_shadow.js');

const h=createUrsinoHeartPeriodShadow();
let s=h.step({timeSec:0,fShSpikesPerSec:3,fVSpikesPerSec:4});
assert.ok(Number.isFinite(s.heartRatePerMin));
assert.equal(s.authority,'counterfactual-shadow-only');

const baseline=s.heartRatePerMin;
for(let t=1;t<=20;t++){
  s=h.step({timeSec:t,fShSpikesPerSec:10,fVSpikesPerSec:2});
}
assert.ok(Number.isFinite(s.heartRatePerMin));
assert.ok(s.heartRatePerMin>baseline);
assert.match(s.publicationStatus,/primary-verification-required/);
console.log('ok - interim Ursino heart-period counterfactual');
