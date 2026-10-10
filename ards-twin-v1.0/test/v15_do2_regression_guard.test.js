'use strict';

const assert=require('node:assert/strict');
const {
  organOxygenDelivery,
  aggregateOrganOxygenDelivery,
}=require('../src/hummod_organ_oxygen_delivery.js');

const baseline=organOxygenDelivery({
  bloodFlowMlPerMin:1000,
  arterialO2ContentMlPerMl:0.20,
  o2UseMlPerMin:50,
  tissueO2ContentMlPerMl:0.15,
});
assert.equal(baseline.oxygenDeliveryMlPerMin,200);
assert.equal(baseline.venousO2OutflowMlPerMin,150);
assert.equal(baseline.massBalanceResidualMlPerMin,0);
assert.equal(baseline.provenance.autonomicGainAdded,false);

const aggregate=aggregateOrganOxygenDelivery({
  brain:{
    bloodFlowMlPerMin:750,
    arterialO2ContentMlPerMl:0.20,
    o2UseMlPerMin:45,
    tissueO2ContentMlPerMl:0.14,
  },
  myocardium:{
    bloodFlowMlPerMin:250,
    arterialO2ContentMlPerMl:0.20,
    o2UseMlPerMin:20,
    tissueO2ContentMlPerMl:0.12,
  },
});
assert.equal(aggregate.totalBloodFlowMlPerMin,1000);
assert.equal(aggregate.totalOxygenDeliveryMlPerMin,200);
assert.equal(aggregate.totalVenousO2OutflowMlPerMin,135);
assert.equal(aggregate.totalO2UseMlPerMin,65);
assert.equal(aggregate.totalMassBalanceResidualMlPerMin,0);

console.log('ok - DO2/tissue-O2 mass-balance guard');
