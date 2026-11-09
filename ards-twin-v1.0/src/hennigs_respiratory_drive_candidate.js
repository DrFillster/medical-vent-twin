'use strict';

const {
  createHennigsBrainCo2TransportCandidate,
} = require('./hennigs_brain_co2_transport_candidate.js');
const {
  createHennigsCsfMedullaryCo2Candidate,
  hendersonHasselbalchPh,
} = require('./hennigs_csf_medullary_co2_candidate.js');
const {
  createHennigsChemicalDriveCandidate,
} = require('./hennigs_chemical_drive_candidate.js');
const {
  createHennigsPatientEffortCandidate,
} = require('./hennigs_patient_effort_candidate.js');

const SOURCE = Object.freeze({
  role: 'candidate composed Hennigs gas-to-drive-to-Pmus runtime',
  authority: 'candidate-not-canonical',
  controlAuthority: false,
  limitation:
    'Requires explicit source-valid brain PCO2, cerebral flow, medullary bicarbonate, and unresolved GPCO2,pH. It is not connected to the live patient.',
});

function finite(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(label + ' must be finite');
  }
  return value;
}
function positive(value, label) {
  finite(value, label);
  if (!(value > 0)) throw new Error(label + ' must be > 0');
  return value;
}

function createHennigsRespiratoryDriveCandidate({
  dtSec = 0.001,
  initialCsfPco2MmHg,
  brainCo2Transport = null,
  gPco2Ph,
  oxygenWeight = 1,
  deterministicNoiseTerm = 0,
  effortGainProfile = 'hennigs-2026-validation-reference',
  kI,
  kE,
  initialRelativeDrive = 0.5,
} = {}) {
  positive(dtSec, 'dtSec');
  finite(initialRelativeDrive, 'initialRelativeDrive');
  if (initialRelativeDrive < 0 || initialRelativeDrive > 1) {
    throw new Error('initialRelativeDrive must be in [0,1]');
  }

  const brainTransport = brainCo2Transport == null
    ? null
    : createHennigsBrainCo2TransportCandidate(brainCo2Transport);
  const csfMedullary = createHennigsCsfMedullaryCo2Candidate({
    initialCsfPco2MmHg,
  });
  const chemical = createHennigsChemicalDriveCandidate({
    gPco2Ph,
    oxygenWeight,
    deterministicNoiseTerm,
  });
  const effort = createHennigsPatientEffortCandidate({
    dtSec,
    dRel: initialRelativeDrive,
    gainProfile: effortGainProfile,
    kI,
    kE,
  });

  let last = null;

  function step({
    dtSec: callerDtSec = dtSec,
    brainPco2MmHg,
    cerebralFlowLPerMin,
    brainPh,
    brainVirtualO2SaturationFraction,
    arterialO2SaturationFraction,
    medullaryBicarbonateMmolPerL,
    arterialPh,
    arterialPco2MmHg,
    arterialPo2MmHg,
  } = {}) {
    if (Math.abs(callerDtSec - dtSec) > 1e-12) {
      throw new Error('respiratory drive dtSec must match configured dtSec');
    }
    positive(medullaryBicarbonateMmolPerL, 'medullaryBicarbonateMmolPerL');

    let resolvedBrainPco2MmHg = brainPco2MmHg;
    let brainTransportState = null;
    if (brainTransport) {
      brainTransportState = brainTransport.step({
        dtSec,
        arterialPco2MmHg,
        arterialPh,
        arterialVirtualO2SaturationFraction:
          arterialO2SaturationFraction,
        cerebralFlowLPerMin,
        brainPh,
        brainVirtualO2SaturationFraction,
      });
      resolvedBrainPco2MmHg = brainTransportState.brainPco2MmHg;
    } else {
      positive(resolvedBrainPco2MmHg, 'brainPco2MmHg');
    }

    const brain = csfMedullary.step({
      dtSec,
      brainPco2MmHg: resolvedBrainPco2MmHg,
      cerebralFlowLPerMin,
    });

    const medullaryPh = hendersonHasselbalchPh({
      pco2MmHg: brain.medullaryPco2MmHg,
      bicarbonateMmolPerL: medullaryBicarbonateMmolPerL,
    });

    const drive = chemical.step({
      dtSec,
      medullaryPh,
      arterialPh,
      arterialPco2MmHg,
      arterialPo2MmHg,
    });

    effort.setRelativeDrive(drive.relativeDrive);
    const effortState = effort.step({ dtSec });

    last = Object.freeze({
      timeSec: effortState.timeSec,
      brain,
      brainTransport: brainTransportState,
      medullaryPh,
      chemicalDrive: drive,
      relativeDrive: drive.relativeDrive,
      respiratoryRatePerMin: effortState.prescribedRespiratoryRatePerMin,
      patientMusclePressureCmH2O: effortState.patientMusclePressureCmH2O,
      effort: effortState,
      authority: SOURCE.authority,
      controlAuthority: false,
      provenance: SOURCE,
    });
    return last;
  }

  function patientEffortProvider(boundaryProvider) {
    if (typeof boundaryProvider !== 'function') {
      throw new Error('boundaryProvider must be a function');
    }
    return args => {
      const boundaries = boundaryProvider(args);
      if (!boundaries || typeof boundaries !== 'object') {
        throw new Error('boundaryProvider must return respiratory-drive boundaries');
      }
      return step({
        dtSec: args.dtSec,
        ...boundaries,
      }).patientMusclePressureCmH2O;
    };
  }

  function snapshot() {
    return last || Object.freeze({
      timeSec: 0,
      brain: csfMedullary.snapshot(),
      brainTransport: brainTransport ? brainTransport.snapshot() : null,
      medullaryPh: null,
      chemicalDrive: chemical.snapshot(),
      relativeDrive: initialRelativeDrive,
      respiratoryRatePerMin: effort.snapshot().prescribedRespiratoryRatePerMin,
      patientMusclePressureCmH2O: effort.snapshot().patientMusclePressureCmH2O,
      effort: effort.snapshot(),
      authority: SOURCE.authority,
      controlAuthority: false,
      provenance: SOURCE,
    });
  }

  return Object.freeze({
    step,
    snapshot,
    patientEffortProvider,
    brainTransport,
    csfMedullary,
    chemical,
    effort,
    source: SOURCE,
  });
}

module.exports = Object.freeze({
  SOURCE,
  createHennigsRespiratoryDriveCandidate,
});
