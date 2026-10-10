'use strict';
const assert=require('node:assert/strict');
const {makeUnavailableHeartPeriodCandidate}=
  require('../src/ursino_heart_period_contract.js');
const s=makeUnavailableHeartPeriodCandidate({
  timeSec:0,
  fShSpikesPerSec:2,
  fVSpikesPerSec:4,
});
assert.equal(s.controlAuthority,false);
assert.equal(s.heartRatePerMin,null);
assert.match(s.status,/blocked/);
console.log('ok - Ursino heart-period candidate fails closed');
