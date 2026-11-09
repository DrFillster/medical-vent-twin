'use strict';

const assert = require('node:assert/strict');
const {
  createHennigsRespiratoryDriveCandidate,
} = require('../src/hennigs_respiratory_drive_candidate.js');

assert.throws(
  () => createHennigsRespiratoryDriveCandidate({
    dtSec: 0.001,
    initialCsfPco2MmHg: 40,
  }),
  /gPco2Ph/
);

const r = createHennigsRespiratoryDriveCandidate({
  dtSec: 0.001,
  initialCsfPco2MmHg: 40,
  // Explicit test boundary only. This is not a promoted source value.
  gPco2Ph: 0,
});

const baseline = r.step({
  brainPco2MmHg: 40,
  cerebralFlowLPerMin: 0.7,
  medullaryBicarbonateMmolPerL: 24,
  arterialPh: 7.40,
  arterialPco2MmHg: 40,
  arterialPo2MmHg: 100,
});

assert(Number.isFinite(baseline.medullaryPh));
assert(Number.isFinite(baseline.respiratoryRatePerMin));
assert(Number.isFinite(baseline.patientMusclePressureCmH2O));
assert(baseline.controlAuthority === false);
assert(baseline.effort.gainProfile === 'hennigs-2026-validation-reference');

let stressed = baseline;
for (let i = 0; i < 20000; i++) {
  stressed = r.step({
    brainPco2MmHg: 60,
    cerebralFlowLPerMin: 0.7,
    medullaryBicarbonateMmolPerL: 24,
    arterialPh: 7.25,
    arterialPco2MmHg: 70,
    arterialPo2MmHg: 45,
  });
}
assert(stressed.chemicalDrive.centralDrive > baseline.chemicalDrive.centralDrive);
assert(stressed.chemicalDrive.peripheralCo2Drive > baseline.chemicalDrive.peripheralCo2Drive);
assert(stressed.chemicalDrive.peripheralO2Drive > baseline.chemicalDrive.peripheralO2Drive);
assert(stressed.medullaryPh < baseline.medullaryPh);
assert(stressed.relativeDrive >= 0 && stressed.relativeDrive <= 1);

assert.throws(
  () => r.step({
    brainPco2MmHg: 40,
    cerebralFlowLPerMin: 0.7,
    arterialPh: 7.40,
    arterialPco2MmHg: 40,
    arterialPo2MmHg: 100,
  }),
  /medullaryBicarbonateMmolPerL/
);

console.log('ok - composed Hennigs respiratory-drive runtime preserves explicit gas boundaries');
console.log(JSON.stringify({
  baselineMedullaryPh: baseline.medullaryPh,
  stressedMedullaryPh: stressed.medullaryPh,
  baselineRelativeDrive: baseline.relativeDrive,
  stressedRelativeDrive: stressed.relativeDrive,
  stressedRespiratoryRate: stressed.respiratoryRatePerMin,
  stressedPmus: stressed.patientMusclePressureCmH2O,
}, null, 2));
