'use strict';
const assert=require('node:assert/strict');
const {makeMicrocirculationShadowInput}=
  require('../src/microcirculation_oxygen_shadow_contract.js');

const s=makeMicrocirculationShadowInput({
  timeSec:0,
  globalOxygenDeliveryMlPerMin:1000,
  regionalOxygenDeliveryMlPerMin:150,
  regionalOxygenUseMlPerMin:45,
});
assert.equal(s.controlAuthority,false);
assert.equal(s.extractionEfficiencyModifier,null);
assert.match(s.status,/blocked/);
console.log('ok - microcirculation oxygen contract fails closed');
