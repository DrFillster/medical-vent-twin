'use strict';

const assert = require('node:assert/strict');
const {
  interpretLiveHennigsBoundaries,
} = require('../src/hennigs_live_boundary_interpretation_candidate.js');

const systemic = {
  gasExchange: {
    paco2MmHg: 44,
    pao2MmHg: 82,
    pH: 7.36,
    arterialHco3MmolPerL: 24.5,
    sao2Fraction: 0.95,
  },
  hemodynamics: {
    brainBloodFlowMlPerMin: 735,
  },
};

const out = interpretLiveHennigsBoundaries(systemic);

assert.equal(out.arterialPco2MmHg, 44);
assert.equal(out.arterialPo2MmHg, 82);
assert.equal(out.arterialPh, 7.36);
assert.equal(out.cerebralFlowLPerMin, 0.735);
assert.equal(out.brainLocalState.pH, 7.36);
assert.equal(out.brainLocalState.virtualO2SaturationFraction, 0.95);
assert.equal(out.medullaryBicarbonateMmolPerL, 24.5);
assert.equal(out.sourceExact, false);
assert.equal(out.controlAuthority, true);
assert.equal(out.authority, 'hennigs-supported');

assert.throws(
  () => interpretLiveHennigsBoundaries({
    gasExchange: systemic.gasExchange,
    hemodynamics: {},
  }),
  /brainBloodFlowMlPerMin/
);

console.log('ok - live Hennigs boundary interpretation is explicit and non-authoritative');
console.log(JSON.stringify(out, null, 2));
