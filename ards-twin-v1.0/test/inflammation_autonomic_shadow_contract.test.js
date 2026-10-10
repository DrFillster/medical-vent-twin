'use strict';
const assert=require('node:assert/strict');
const {makeInflammationAutonomicShadowUnavailable}=
  require('../src/inflammation_autonomic_shadow_contract.js');
const s=makeInflammationAutonomicShadowUnavailable({timeSec:0});
assert.equal(s.controlAuthority,false);
assert.equal(s.heartRateVariabilityState,null);
assert.match(s.status,/blocked/);
console.log('ok - inflammation/autonomic contract fails closed');
