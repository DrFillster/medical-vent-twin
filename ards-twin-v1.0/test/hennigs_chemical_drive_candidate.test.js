'use strict';

const assert = require('node:assert/strict');
const {
  MMHG_PER_KPA,
  createHennigsChemicalDriveCandidate,
} = require('../src/hennigs_chemical_drive_candidate.js');

assert(Math.abs(MMHG_PER_KPA - 7.500616827041697) < 1e-12);

assert.throws(
  () => createHennigsChemicalDriveCandidate({ oxygenWeight: 0.25 }),
  /gPco2Ph/
);
function run(inputs, oxygenWeight = 1) {
  const r = createHennigsChemicalDriveCandidate({
    // Zero is an explicit test boundary, not a proposed physiologic value.
    gPco2Ph: 0,
    oxygenWeight,
    deterministicNoiseTerm: 0,
  });
  let s;
  for (let i = 0; i < 30; i++) {
    s = r.step({ dtSec: 1, ...inputs });
  }
  return s;
}

const baseline = run({
  medullaryPh: 7.32,
  arterialPh: 7.40,
  arterialPco2MmHg: 40,
  arterialPo2MmHg: 100,
});
const hypercapnia = run({
  medullaryPh: 7.25,
  arterialPh: 7.25,
  arterialPco2MmHg: 70,
  arterialPo2MmHg: 100,
});
const hypoxia = run({
  medullaryPh: 7.32,
  arterialPh: 7.40,
  arterialPco2MmHg: 40,
  arterialPo2MmHg: 45,
});

assert(hypercapnia.centralDrive > baseline.centralDrive);
assert(hypercapnia.peripheralCo2Drive > baseline.peripheralCo2Drive);
assert(hypoxia.peripheralO2Drive > baseline.peripheralO2Drive);
assert(hypoxia.inputs.arterialPo2MmHg === 45);
assert(baseline.peripheralO2Drive === 0);
assert(hypercapnia.controlAuthority === false);
assert(hypercapnia.authority === 'candidate-not-canonical');

const experimentalQuarterWeight = run({
  medullaryPh: 7.32,
  arterialPh: 7.40,
  arterialPco2MmHg: 40,
  arterialPo2MmHg: 45,
}, 0.25);
assert(hypoxia.totalChemicalDrive > experimentalQuarterWeight.totalChemicalDrive,
  'validation RC2 direct-sum O2 path must exceed explicit quarter-weight experiment');

console.log('ok - Hennigs chemical drive is source-structured and fails closed at unresolved parameters');
console.log(JSON.stringify({
  baseline: baseline.relativeDrive,
  hypercapnia: hypercapnia.relativeDrive,
  hypoxia: hypoxia.relativeDrive,
  validationDirectSumTotal: hypoxia.totalChemicalDrive,
  explicitQuarterWeightTotal: experimentalQuarterWeight.totalChemicalDrive,
}, null, 2));

{
  const c = createHennigsChemicalDriveCandidate({
    gPco2Ph: 80,
    parameterProfile: 'validation-paper',
  });
  let s;
  for (let i = 0; i < 120; i += 1) {
    s = c.step({dtSec:1,medullaryPh:7.20,arterialPh:7.20,arterialPco2MmHg:60,arterialPo2MmHg:100});
  }
  assert(s.frequencyRelativeDrive >= s.amplitudeRelativeDrive);
  assert(s.amplitudeRelativeDrive <= 1);
  assert(s.frequencyRelativeDrive > 1);
  console.log('ok - supranormal frequency drive is preserved while amplitude drive remains bounded');
}
