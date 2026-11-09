'use strict';

const {
  heringBreuerDrive,
  inspiratoryFlowDrive,
} = require('./hennigs_respiratory_center_primitives.js');

const SOURCE = Object.freeze({
  citation:
    'Hennigs C et al. Validation of a Computational Respiratory System Model for Mechanical Ventilation. arXiv:2607.06210v2 (2026).',
  companionPrimarySource: '10.1016/j.cmpb.2026.109329',
  equations: 'primary Eqs. 11-12; validation reference parameter table',
  authority: 'candidate-not-canonical',
  controlAuthority: false,
  referenceParameters: Object.freeze({
    kPrsPerL: 7.5,
    kInspSecPerL: 0.1,
    functionalResidualCapacityL: 2.5,
    heringBreuerThresholdRangeL: Object.freeze([1, 1.5]),
  }),
  limitation:
    'Reflex equations and BI/BE mapping are source-backed; thresholds and reference parameters remain validation-reference values, not patient measurements.',
});

function finite(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(label + ' must be finite');
  }
  return value;
}
function nonNegative(value, label) {
  finite(value, label);
  if (value < 0) throw new Error(label + ' must be >= 0');
  return value;
}
function positive(value, label) {
  finite(value, label);
  if (!(value > 0)) throw new Error(label + ' must be > 0');
  return value;
}

function createHennigsMechanicalFeedbackCandidate({
  endExpiratoryVolumeL,
  heringBreuerThresholdL,
  functionalResidualCapacityL = SOURCE.referenceParameters.functionalResidualCapacityL,
  kPrsPerL = SOURCE.referenceParameters.kPrsPerL,
  kInspSecPerL = SOURCE.referenceParameters.kInspSecPerL,
} = {}) {
  nonNegative(endExpiratoryVolumeL, 'endExpiratoryVolumeL');
  nonNegative(functionalResidualCapacityL, 'functionalResidualCapacityL');
  positive(heringBreuerThresholdL, 'heringBreuerThresholdL');
  positive(kPrsPerL, 'kPrsPerL');
  positive(kInspSecPerL, 'kInspSecPerL');

  let currentEndExpiratoryVolumeL = endExpiratoryVolumeL;
  const volumeReferenceOffsetL = functionalResidualCapacityL;
  let last = null;

  function setEndExpiratoryVolumeL(value) {
    nonNegative(value, 'endExpiratoryVolumeL');
    currentEndExpiratoryVolumeL = value;
    return snapshot();
  }

  function evaluate({
    totalLungVolumeL,
    airwayFlowLps,
  } = {}) {
    nonNegative(totalLungVolumeL, 'totalLungVolumeL');
    finite(airwayFlowLps, 'airwayFlowLps');

    const inspiratoryFlowLps = Math.max(0, airwayFlowLps);
    const absoluteLungVolumeL = volumeReferenceOffsetL + totalLungVolumeL;
    const absoluteEndExpiratoryVolumeL =
      volumeReferenceOffsetL + currentEndExpiratoryVolumeL;
    const hbDrive = heringBreuerDrive({
      lungVolume: absoluteLungVolumeL,
      endExpiratoryVolume: absoluteEndExpiratoryVolumeL,
      thresholdVolume: heringBreuerThresholdL,
      kPrs: kPrsPerL,
    });
    const inspFlowDrive = inspiratoryFlowDrive({
      inspiratoryFlow: inspiratoryFlowLps,
      kInsp: kInspSecPerL,
    });

    last = Object.freeze({
      totalLungVolumeL,
      absoluteLungVolumeL,
      volumeReferenceOffsetL,
      endExpiratoryVolumeL: currentEndExpiratoryVolumeL,
      absoluteEndExpiratoryVolumeL,
      excessVolumeAboveEndExpirationL:
        totalLungVolumeL - currentEndExpiratoryVolumeL,
      airwayFlowLps,
      inspiratoryFlowLps,
      heringBreuerDrive: hbDrive,
      inspiratoryFlowDrive: inspFlowDrive,
      interpretation: Object.freeze({
        heringBreuer:
          'source reflex drive; inhibits inspiration and promotes expiration',
        inspiratoryFlow:
          'source reflex drive; inhibits inspiration and promotes expiration',
      }),
      authority: SOURCE.authority,
      controlAuthority: false,
      provenance: SOURCE,
    });
    return last;
  }

  function fromSimulation(simulation) {
    if (!simulation || !simulation.state) {
      throw new Error('simulation with current Vent state is required');
    }
    return evaluate({
      totalLungVolumeL: simulation.state.totalVolume,
      airwayFlowLps: simulation.state.totalFlow,
    });
  }

  function snapshot() {
    return last;
  }

  return Object.freeze({
    evaluate,
    fromSimulation,
    setEndExpiratoryVolumeL,
    snapshot,
    source: SOURCE,
  });
}

module.exports = Object.freeze({
  SOURCE,
  createHennigsMechanicalFeedbackCandidate,
});
