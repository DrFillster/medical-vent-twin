'use strict';

const {
  createHennigsNeuralOscillatorRuntime,
} = require('./hennigs_neural_oscillator_runtime.js');
const {
  respiratoryMusclePressure,
} = require('./hennigs_respiratory_center_primitives.js');

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

function createHennigsPatientEffortCandidate({
  dtSec = 0.001,
  dRel = 0.5,
  kI,
  kE,
  expiratoryThreshold = 5.2,
  oscillatorOptions = null,
} = {}) {
  nonNegative(kI, 'kI');
  nonNegative(kE, 'kE');
  finite(expiratoryThreshold, 'expiratoryThreshold');

  const oscillator = createHennigsNeuralOscillatorRuntime({
    dtSec,
    dRel,
    ...(oscillatorOptions || {}),
  });
  let last = null;

  function step({ dtSec: callerDtSec } = {}) {
    if (callerDtSec != null && Math.abs(callerDtSec - dtSec) > 1e-12) {
      throw new Error('Hennigs effort bridge dtSec must match Vent dtSec');
    }
    const neural = oscillator.step();
    const patientMusclePressureCmH2O = respiratoryMusclePressure({
      inspiratoryActivity: neural.neuralOutput.I,
      expiratoryActivity: neural.neuralOutput.E,
      expiratoryThreshold,
      kI,
      kE,
    });
    last = Object.freeze({
      timeSec: neural.timeSec,
      patientMusclePressureCmH2O,
      inspiratoryActivity: neural.neuralOutput.I,
      expiratoryActivity: neural.neuralOutput.E,
      prescribedRespiratoryRatePerMin: neural.prescribedRespiratoryRatePerMin,
      dRel: neural.dRel,
      authority: SOURCE.authority,
      controlAuthority: false,
      provenance: SOURCE,
    });
    return last;
  }

  function provider(args = {}) {
    return step(args).patientMusclePressureCmH2O;
  }

  function snapshot() {
    return last || Object.freeze({
      timeSec: 0,
      patientMusclePressureCmH2O: 0,
      inspiratoryActivity: null,
      expiratoryActivity: null,
      prescribedRespiratoryRatePerMin: oscillator.snapshot().prescribedRespiratoryRatePerMin,
      dRel: oscillator.snapshot().dRel,
      authority: SOURCE.authority,
      controlAuthority: false,
      provenance: SOURCE,
    });
  }

  return Object.freeze({
    provider,
    step,
    snapshot,
    oscillator,
    source: SOURCE,
  });
}

module.exports = Object.freeze({
  SOURCE,
  createHennigsPatientEffortCandidate,
});
