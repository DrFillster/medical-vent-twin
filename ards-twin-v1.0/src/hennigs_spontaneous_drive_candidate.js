'use strict';

const {
  createHennigsChemicalDriveCandidate,
} = require('./hennigs_chemical_drive_candidate.js');
const {
  createHennigsPatientEffortCandidate,
} = require('./hennigs_patient_effort_candidate.js');

const SOURCE = Object.freeze({
  role: 'candidate chemical-drive to oscillator to Pmus coordinator',
  authority: 'candidate-not-canonical',
  controlAuthority: false,
  limitation:
    'Requires an external source-valid medullary-pH provider and explicit unresolved GPCO2,pH before live control.',
});

function finite(v, label) {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error(label + ' must be finite');
  }
  return v;
}

function createHennigsSpontaneousDriveCandidate({
  dtSec = 0.001,
  dRel = 0.5,
  chemicalDrive,
  effort,
} = {}) {
  if (!chemicalDrive || typeof chemicalDrive.step !== 'function') {
    throw new Error('chemicalDrive candidate is required');
  }
  if (!effort || typeof effort.provider !== 'function' ||
      typeof effort.setRelativeDrive !== 'function') {
    throw new Error('effort candidate with setRelativeDrive is required');
  }

  let lastChemistry = null;
  let lastEffort = null;

  function provider({
    dtSec: callerDtSec,
    gasState,
    medullaryPh,
  } = {}) {
    finite(callerDtSec, 'dtSec');
    if (Math.abs(callerDtSec - dtSec) > 1e-12) {
      throw new Error('spontaneous-drive dtSec must match Vent dtSec');
    }
    if (!gasState) throw new Error('gasState is required');
    finite(medullaryPh, 'medullaryPh');

    const arterialPh = finite(gasState.pH, 'gasState.pH');
    const arterialPco2MmHg = finite(gasState.paco2, 'gasState.paco2');
    const arterialPo2MmHg = finite(gasState.pao2, 'gasState.pao2');

    lastChemistry = chemicalDrive.step({
      dtSec,
      medullaryPh,
      arterialPh,
      arterialPco2MmHg,
      arterialPo2MmHg,
    });
    effort.setRelativeDrive(lastChemistry.relativeDrive);
    const patientMusclePressureCmH2O = effort.provider({ dtSec });
    lastEffort = effort.snapshot();
    return patientMusclePressureCmH2O;
  }

  function snapshot() {
    return Object.freeze({
      chemistry: lastChemistry,
      effort: lastEffort,
      authority: SOURCE.authority,
      controlAuthority: false,
      provenance: SOURCE,
    });
  }

  return Object.freeze({
    provider,
    snapshot,
    source: SOURCE,
  });
}

module.exports = Object.freeze({
  SOURCE,
  createHennigsSpontaneousDriveCandidate,
  createHennigsChemicalDriveCandidate,
  createHennigsPatientEffortCandidate,
});
