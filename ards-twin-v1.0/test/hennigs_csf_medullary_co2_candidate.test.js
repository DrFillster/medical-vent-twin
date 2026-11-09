'use strict';

const assert = require('node:assert/strict');
const {
  SOURCE,
  hendersonHasselbalchPh,
  createHennigsCsfMedullaryCo2Candidate,
} = require('../src/hennigs_csf_medullary_co2_candidate.js');

assert.equal(SOURCE.parameters.csfTauSec, 320);
assert.equal(SOURCE.parameters.cerebralExchangeK, 1.139);

assert.throws(
  () => createHennigsCsfMedullaryCo2Candidate({}),
  /initialCsfPco2MmHg/
);

const runtime = createHennigsCsfMedullaryCo2Candidate({
  initialCsfPco2MmHg: 40,
});

const first = runtime.step({
  dtSec: 1,
  brainPco2MmHg: 60,
  cerebralFlowLPerMin: 0.7,
});

assert(first.csfPco2MmHg > 40 && first.csfPco2MmHg < 60);
assert(first.medullaryPco2MmHg > first.csfPco2MmHg);
assert(first.medullaryPco2MmHg < 60);
assert(first.controlAuthority === false);

let after = first;
for (let i = 0; i < 319; i++) {
  after = runtime.step({
    dtSec: 1,
    brainPco2MmHg: 60,
    cerebralFlowLPerMin: 0.7,
  });
}
assert(after.csfPco2MmHg > first.csfPco2MmHg);
assert(after.csfPco2MmHg < 60);

const ph40 = hendersonHasselbalchPh({
  pco2MmHg: 40,
  bicarbonateMmolPerL: 24,
});
const ph60 = hendersonHasselbalchPh({
  pco2MmHg: 60,
  bicarbonateMmolPerL: 24,
});
assert(ph60 < ph40);

assert.throws(
  () => runtime.step({
    dtSec: 1,
    cerebralFlowLPerMin: 0.7,
  }),
  /brainPco2MmHg/
);
assert.throws(
  () => hendersonHasselbalchPh({
    pco2MmHg: 40,
  }),
  /bicarbonateMmolPerL/
);

console.log('ok - Hennigs CSF/medullary CO2 layer preserves explicit brain/CSF boundaries');
console.log(JSON.stringify({
  firstCsfPco2: first.csfPco2MmHg,
  firstMedullaryPco2: first.medullaryPco2MmHg,
  csfPco2At320s: after.csfPco2MmHg,
  ph40,
  ph60,
}, null, 2));
