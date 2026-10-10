'use strict';
const assert=require('node:assert/strict');
const {makeSepsisExtractionShadow}=
  require('../src/sepsis_oxygen_extraction_shadow_contract.js');
const s=makeSepsisExtractionShadow({
  timeSec:0,
  inflammationState:0,
  globalOxygenDeliveryMlPerMin:1000,
  globalExtractionRatio:0.25,
});
assert.equal(s.controlAuthority,false);
assert.equal(s.regionalExtractionImpairment,null);
assert.match(s.status,/blocked/);
console.log('ok - sepsis extraction contract fails closed');
