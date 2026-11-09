'use strict';

const {
  createHennigsNeuralOscillatorRuntime,
} = require('./hennigs_neural_oscillator_runtime.js');
const {
  respiratoryMusclePressure,
} = require('./hennigs_respiratory_center_primitives.js');
const {
  createHennigsPhysicalClockAdapter,
} = require('./hennigs_physical_clock_adapter.js');

const CMH2O_PER_MMHG = 1.3595100263596638;

const HENNIGS_2026_VALIDATION_REFERENCE = Object.freeze({
  kI: 1.87,
  kE: 1.87,
  units: 'mmHg/exc',
  role: 'published baseline respiratory-center gains',
  authority: 'validation-reference-not-patient-specific',
  citation: 'Hennigs C et al. Validation of a Computational Respiratory System Model for Mechanical Ventilation. 2026.',
});

const SOURCE = Object.freeze({
  citation: 'Hennigs C et al. Comput Methods Programs Biomed. 2026;280:109329.',
  doi: '10.1016/j.cmpb.2026.109329',
  role: 'candidate Hennigs neural-output to Vent patient-effort bridge',
  authority: 'candidate-not-canonical',
  limitation:
    'kI/kE must be supplied from an independently verified Pmax/phi_max source chain; no default gain is permitted.',
});

function finite(v, label) {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error(label + ' must be finite');
  }
  return v;
}
function nonNegative(v, label) {
  finite(v, label);
  if (v < 0) throw new Error(label + ' must be >= 0');
  return v;
}
function unitInterval(v, label) {
  finite(v, label);
  if (v < 0 || v > 1) throw new Error(label + ' must be in [0,1]');
  return v;
}

function createHennigsPatientEffortCandidate({
  dtSec = 0.001,
  dRel = 0.5,
  kI,
  kE,
  gainProfile = null,
  respiratoryFailureFraction = 0,
  expiratoryThreshold = 5.2,
  oscillatorOptions = null,
  physicalClock = null,
} = {}) {
  if (gainProfile === 'hennigs-2026-validation-reference') {
    if (kI != null || kE != null) {
      throw new Error('do not combine validation-reference gainProfile with explicit kI/kE');
    }
    kI = HENNIGS_2026_VALIDATION_REFERENCE.kI;
    kE = HENNIGS_2026_VALIDATION_REFERENCE.kE;
  } else if (gainProfile != null) {
    throw new Error('unsupported gainProfile: ' + gainProfile);
  }
  nonNegative(kI, 'kI');
  nonNegative(kE, 'kE');
  unitInterval(respiratoryFailureFraction, 'respiratoryFailureFraction');
  finite(expiratoryThreshold, 'expiratoryThreshold');

  const gainPressureConversion = gainProfile === 'hennigs-2026-validation-reference'
    ? CMH2O_PER_MMHG
    : 1;
  const effectiveKI = kI * gainPressureConversion *
    (1 - respiratoryFailureFraction);
  const effectiveKE = kE * gainPressureConversion *
    (1 - respiratoryFailureFraction);

  const oscillator = createHennigsNeuralOscillatorRuntime({
    dtSec,
    dRel,
    ...(oscillatorOptions || {}),
  });
  let last = null;
  let physicalTimeSec = 0;
  let rawStepAccumulator = 0;
  let clockAdapter = null;
  if (physicalClock != null) {
    if (physicalClock.profile !== 'hennigs-eq9') throw new Error('unsupported physicalClock profile');
    clockAdapter = createHennigsPhysicalClockAdapter({
      estimateRawPeriodSec: physicalClock.estimateRawPeriodSec,
    });
  }

  function step({ dtSec: callerDtSec } = {}) {
    if (callerDtSec != null && Math.abs(callerDtSec - dtSec) > 1e-12) {
      throw new Error('Hennigs effort bridge dtSec must match Vent dtSec');
    }
    let neural;
    let clockMapping = null;
    if (clockAdapter) {
      clockMapping = clockAdapter.mapping(oscillator.snapshot().dRel);
      rawStepAccumulator += clockMapping.rawTimePerPhysicalSecond;
      const rawSteps = Math.floor(rawStepAccumulator + 1e-12);
      rawStepAccumulator -= rawSteps;
      for (let i = 0; i < rawSteps; i++) neural = oscillator.step();
      neural = neural || oscillator.snapshot();
      physicalTimeSec += dtSec;
    } else {
      neural = oscillator.step();
      physicalTimeSec = neural.timeSec;
    }
    const patientMusclePressureCmH2O = respiratoryMusclePressure({
      inspiratoryActivity: neural.state.I,
      expiratoryActivity: neural.state.E,
      expiratoryThreshold,
      kI: effectiveKI,
      kE: effectiveKE,
    });
    last = Object.freeze({
      timeSec: physicalTimeSec,
      oscillatorRawTime: neural.timeSec,
      physicalClock: clockMapping,
      patientMusclePressureCmH2O,
      inspiratoryActivity: neural.state.I,
      expiratoryActivity: neural.state.E,
      prescribedRespiratoryRatePerMin: neural.prescribedRespiratoryRatePerMin,
      dRel: neural.dRel,
      authority: SOURCE.authority,
      controlAuthority: false,
      gainProfile: gainProfile || 'explicit',
      muscleGains: Object.freeze({
        sourceKI: kI,
        sourceKE: kE,
        effectiveKICmH2OPerExc: effectiveKI,
        effectiveKECmH2OPerExc: effectiveKE,
        respiratoryFailureFraction,
      }),
      gainProvenance: gainProfile ? HENNIGS_2026_VALIDATION_REFERENCE : null,
      provenance: SOURCE,
    });
    return last;
  }

  function setMechanicalFeedback({
    heringBreuerDrive = 0,
    inspiratoryFlowDrive = 0,
  } = {}) {
    nonNegative(heringBreuerDrive, 'heringBreuerDrive');
    nonNegative(inspiratoryFlowDrive, 'inspiratoryFlowDrive');
    const total = heringBreuerDrive + inspiratoryFlowDrive;
    oscillator.setTonicAdjustments({
      I: -total,
      E: total,
    });
    return snapshot();
  }

  function provider(args = {}) {
    return step(args).patientMusclePressureCmH2O;
  }

  function snapshot() {
    return last || Object.freeze({
      timeSec: physicalTimeSec,
      patientMusclePressureCmH2O: 0,
      inspiratoryActivity: null,
      expiratoryActivity: null,
      prescribedRespiratoryRatePerMin: oscillator.snapshot().prescribedRespiratoryRatePerMin,
      dRel: oscillator.snapshot().dRel,
      authority: SOURCE.authority,
      controlAuthority: false,
      gainProfile: gainProfile || 'explicit',
      muscleGains: Object.freeze({
        sourceKI: kI,
        sourceKE: kE,
        effectiveKICmH2OPerExc: effectiveKI,
        effectiveKECmH2OPerExc: effectiveKE,
        respiratoryFailureFraction,
      }),
      gainProvenance: gainProfile ? HENNIGS_2026_VALIDATION_REFERENCE : null,
      provenance: SOURCE,
    });
  }

  function setRelativeDrive(next) {
    oscillator.setRelativeDrive(next);
    return snapshot();
  }

  return Object.freeze({
    provider,
    step,
    snapshot,
    setRelativeDrive,
    setMechanicalFeedback,
    oscillator,
    source: SOURCE,
  });
}

module.exports = Object.freeze({
  SOURCE,
  CMH2O_PER_MMHG,
  HENNIGS_2026_VALIDATION_REFERENCE,
  createHennigsPatientEffortCandidate,
});
