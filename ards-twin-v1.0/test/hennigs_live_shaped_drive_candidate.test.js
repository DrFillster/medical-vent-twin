'use strict';

const assert = require('node:assert/strict');
const {
  interpretLiveHennigsBoundaries,
} = require('../src/hennigs_live_boundary_interpretation_candidate.js');
const {
  createHennigsRespiratoryDriveCandidate,
} = require('../src/hennigs_respiratory_drive_candidate.js');

const live = {
  gasExchange: {
    paco2MmHg: 48,
    pao2MmHg: 72,
    pH: 7.33,
    arterialHco3MmolPerL: 24,
    sao2Fraction: 0.92,
  },
  hemodynamics: {
    brainBloodFlowMlPerMin: 720,
  },
};

const interpreted = interpretLiveHennigsBoundaries(live);
assert.equal(interpreted.sourceExact, false);

const drive = createHennigsRespiratoryDriveCandidate({
  dtSec: 0.001,
  initialCsfPco2MmHg: 42,
  brainCo2Transport: {
    initialBrainPco2MmHg: 45,
    initialBrainPh: interpreted.brainLocalState.pH,
    initialBrainVirtualO2SaturationFraction:
      interpreted.brainLocalState.virtualO2SaturationFraction,
  },
  // Explicit shadow-test boundary only. Missing source value remains unresolved.
  gPco2Ph: 0,
  initialRelativeDrive: 0.5,
});

let state;
for (let i = 0; i < 10000; i++) {
  state = drive.step({
    dtSec: 0.001,
    cerebralFlowLPerMin: interpreted.cerebralFlowLPerMin,
    brainPh: interpreted.brainLocalState.pH,
    brainVirtualO2SaturationFraction:
      interpreted.brainLocalState.virtualO2SaturationFraction,
    arterialO2SaturationFraction:
      interpreted.arterialO2SaturationFraction,
    medullaryBicarbonateMmolPerL:
      interpreted.medullaryBicarbonateMmolPerL,
    arterialPh: interpreted.arterialPh,
    arterialPco2MmHg: interpreted.arterialPco2MmHg,
    arterialPo2MmHg: interpreted.arterialPo2MmHg,
  });
}

assert(state.brainTransport);
assert(Number.isFinite(state.brainTransport.brainPco2MmHg));
assert(Number.isFinite(state.brain.csfPco2MmHg));
assert(Number.isFinite(state.medullaryPh));
assert(Number.isFinite(state.respiratoryRatePerMin));
assert(Number.isFinite(state.patientMusclePressureCmH2O));
assert(state.controlAuthority === false);
assert(drive.brainTransport.snapshot().controlAuthority === false);

console.log('ok - live-shaped interpreted boundaries traverse brain CO2, CSF and Hennigs drive in shadow mode');
console.log(JSON.stringify({
  brainPco2MmHg: state.brainTransport.brainPco2MmHg,
  csfPco2MmHg: state.brain.csfPco2MmHg,
  medullaryPh: state.medullaryPh,
  relativeDrive: state.relativeDrive,
  respiratoryRatePerMin: state.respiratoryRatePerMin,
  patientMusclePressureCmH2O: state.patientMusclePressureCmH2O,
}, null, 2));
