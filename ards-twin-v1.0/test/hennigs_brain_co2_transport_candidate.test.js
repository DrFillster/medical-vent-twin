'use strict';

const assert = require('node:assert/strict');
const {
  SOURCE,
  co2ConcentrationLPerL,
  pco2FromConcentrationMmHg,
  createHennigsBrainCo2TransportCandidate,
} = require('../src/hennigs_brain_co2_transport_candidate.js');

assert.equal(SOURCE.parameters.brainTissueVolumeL, 0.90);
assert.equal(SOURCE.parameters.brainCo2ProductionLPerMin, 0.05);

const c40 = co2ConcentrationLPerL({
  pco2MmHg: 40,
  pH: 7.40,
  virtualO2SaturationFraction: 0.97,
});
const recovered40 = pco2FromConcentrationMmHg({
  concentrationLPerL: c40,
  pH: 7.40,
  virtualO2SaturationFraction: 0.97,
});
assert(Math.abs(recovered40 - 40) < 1e-10);

assert.throws(
  () => createHennigsBrainCo2TransportCandidate({
    initialBrainPco2MmHg: 40,
    initialBrainVirtualO2SaturationFraction: 0.8,
  }),
  /initialBrainPh/
);

const r = createHennigsBrainCo2TransportCandidate({
  initialBrainPco2MmHg: 45,
  initialBrainPh: 7.34,
  initialBrainVirtualO2SaturationFraction: 0.75,
});

const baseline = r.snapshot();
let stressed = baseline;
for (let i = 0; i < 60; i++) {
  stressed = r.step({
    dtSec: 1,
    arterialPco2MmHg: 70,
    arterialPh: 7.25,
    arterialVirtualO2SaturationFraction: 0.90,
    cerebralFlowLPerMin: 0.70,
    brainPh: 7.30,
    brainVirtualO2SaturationFraction: 0.72,
  });
}

assert(stressed.brainPco2MmHg > baseline.brainPco2MmHg);
assert(stressed.brainCo2ConcentrationLPerL >
  baseline.brainCo2ConcentrationLPerL);
assert(stressed.controlAuthority === false);

assert.throws(
  () => r.step({
    dtSec: 1,
    arterialPco2MmHg: 40,
    arterialPh: 7.40,
    arterialVirtualO2SaturationFraction: 0.97,
    cerebralFlowLPerMin: 0.70,
    brainVirtualO2SaturationFraction: 0.72,
  }),
  /brainPh/
);

console.log('ok - Hennigs GE7 brain CO2 transport uses explicit local acid-base and O2 state');
console.log(JSON.stringify({
  c40,
  recovered40,
  baselineBrainPco2: baseline.brainPco2MmHg,
  stressedBrainPco2: stressed.brainPco2MmHg,
}, null, 2));
