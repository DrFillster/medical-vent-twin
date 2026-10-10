'use strict';
const assert=require('node:assert/strict');
const {
  regionalOxygenTransport,
  compareRegionalToGlobal,
}=require('../src/oxygen_transport_regional_audit.js');

const brain=regionalOxygenTransport({
  bloodFlowMlPerMin:750,
  arterialO2ContentMlPerMl:0.20,
  venousO2ContentMlPerMl:0.14,
  oxygenUseMlPerMin:45,
});
assert.equal(brain.oxygenDeliveryMlPerMin,150);
assert.equal(brain.supplyDependent,null);
assert.equal(brain.criticalDeliveryMlPerMin,null);
assert.equal(brain.provenance.universalCriticalThresholdApplied,false);

const cmp=compareRegionalToGlobal({
  global:{bloodFlowMlPerMin:5000,oxygenDeliveryMlPerMin:1000},
  regions:{
    brain:{
      bloodFlowMlPerMin:750,
      arterialO2ContentMlPerMl:0.20,
      venousO2ContentMlPerMl:0.14,
      oxygenUseMlPerMin:45,
    },
  },
});
assert.equal(cmp.controlAuthority,false);
assert.ok(cmp.regions.brain.fractionOfGlobalDelivery>0);
console.log('ok - regional oxygen transport audit has no universal threshold');
