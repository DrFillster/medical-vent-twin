'use strict';

const {
  createHennigsMechanicalFeedbackCandidate,
} = require('./hennigs_mechanical_feedback_candidate.js');

const SOURCE = Object.freeze({
  role: 'candidate closed Hennigs mechanical-reflex to Pmus bridge',
  authority: 'candidate-not-canonical',
  controlAuthority: false,
  mapping:
    'Vent V/flow -> DHB/Dinsp -> BI subtraction / BE addition -> Hennigs oscillator -> Pmus',
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

function createHennigsMechanicalClosedEffortCandidate({
  effort,
  initialEndExpiratoryVolumeL,
  heringBreuerThresholdL,
  functionalResidualCapacityL,
  kPrsPerL,
  kInspSecPerL,
} = {}) {
  if (!effort || typeof effort.provider !== 'function' ||
      typeof effort.setMechanicalFeedback !== 'function') {
    throw new Error('effort bridge with provider and setMechanicalFeedback is required');
  }
  nonNegative(initialEndExpiratoryVolumeL, 'initialEndExpiratoryVolumeL');

  const feedback = createHennigsMechanicalFeedbackCandidate({
    endExpiratoryVolumeL: initialEndExpiratoryVolumeL,
    heringBreuerThresholdL,
    ...(functionalResidualCapacityL == null ? {} : { functionalResidualCapacityL }),
    ...(kPrsPerL == null ? {} : { kPrsPerL }),
    ...(kInspSecPerL == null ? {} : { kInspSecPerL }),
  });

  let previousPhase = null;
  let expiratoryMinimumVolumeL = initialEndExpiratoryVolumeL;
  let endExpiratoryVolumeL = initialEndExpiratoryVolumeL;
  let last = null;

  function provider(args = {}) {
    if (!args.state || typeof args.state !== 'object') {
      throw new Error('Vent state is required');
    }
    const totalVolumeL = args.state.totalVolume;
    const airwayFlowLps = args.state.totalFlow;
    nonNegative(totalVolumeL, 'state.totalVolume');
    finite(airwayFlowLps, 'state.totalFlow');

    const phase = args.phase || null;

    if (phase === 'EXPIRATION') {
      expiratoryMinimumVolumeL = Math.min(
        expiratoryMinimumVolumeL,
        totalVolumeL
      );
    }

    if (phase === 'INSPIRATION' && previousPhase === 'EXPIRATION') {
      endExpiratoryVolumeL = expiratoryMinimumVolumeL;
      feedback.setEndExpiratoryVolumeL(endExpiratoryVolumeL);
      expiratoryMinimumVolumeL = totalVolumeL;
    }

    if (phase === 'EXPIRATION' && previousPhase !== 'EXPIRATION') {
      expiratoryMinimumVolumeL = totalVolumeL;
    }

    const mechanical = feedback.evaluate({
      totalLungVolumeL: totalVolumeL,
      airwayFlowLps,
    });

    effort.setMechanicalFeedback({
      heringBreuerDrive: mechanical.heringBreuerDrive,
      inspiratoryFlowDrive: mechanical.inspiratoryFlowDrive,
    });

    const patientMusclePressureCmH2O = effort.provider(args);
    previousPhase = phase;

    last = Object.freeze({
      timeSec: args.timeSec ?? null,
      phase,
      endExpiratoryVolumeL,
      expiratoryMinimumVolumeL,
      mechanical,
      patientMusclePressureCmH2O,
      effort: effort.snapshot(),
      authority: SOURCE.authority,
      controlAuthority: false,
      provenance: SOURCE,
    });

    return patientMusclePressureCmH2O;
  }

  function snapshot() {
    return last || Object.freeze({
      timeSec: 0,
      phase: previousPhase,
      endExpiratoryVolumeL,
      expiratoryMinimumVolumeL,
      mechanical: feedback.snapshot(),
      patientMusclePressureCmH2O: effort.snapshot().patientMusclePressureCmH2O,
      effort: effort.snapshot(),
      authority: SOURCE.authority,
      controlAuthority: false,
      provenance: SOURCE,
    });
  }

  return Object.freeze({
    provider,
    snapshot,
    feedback,
    effort,
    source: SOURCE,
  });
}

module.exports = Object.freeze({
  SOURCE,
  createHennigsMechanicalClosedEffortCandidate,
});
