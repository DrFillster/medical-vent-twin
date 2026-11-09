'use strict';

const {
  heringBreuerDrive,
  inspiratoryFlowDrive,
} = require('./hennigs_respiratory_center_primitives.js');

const SOURCE = Object.freeze({
  citation:
    'Hennigs C et al. Patient-ventilator interaction—Development of a mathematical model of the respiratory center. Comput Methods Programs Biomed. 2026;280:109329.',
  doi: '10.1016/j.cmpb.2026.109329',
  equations: '11,12',
  authority: 'candidate-not-canonical',
  controlAuthority: false,
  referenceParameters: Object.freeze({
    kPrsPerL: 7.5,
    kInspSecPerL: 2,
    heringBreuerThresholdRangeL: Object.freeze([1, 1.5]),
  }),
  limitation:
    'The reflex drives are source-structured, but their complete neural-population injection mapping is not promoted here.',
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
  kPrsPerL = SOURCE.referenceParameters.kPrsPerL,
  kInspSecPerL = SOURCE.referenceParameters.kInspSecPerL,
} = {}) {
  nonNegative(endExpiratoryVolumeL, 'endExpiratoryVolumeL');
  positive(heringBreuerThresholdL, 'heringBreuerThresholdL');
  positive(kPrsPerL, 'kPrsPerL');
  positive(kInspSecPerL, 'kInspSecPerL');

  let last = null;

  function evaluate({
    totalLungVolumeL,
    airwayFlowLps,
  } = {}) {
    nonNegative(totalLungVolumeL, 'totalLungVolumeL');
    finite(airwayFlowLps, 'airwayFlowLps');

    const inspiratoryFlowLps = Math.max(0, airwayFlowLps);
    const hbDrive = heringBreuerDrive({
      lungVolume: totalLungVolumeL,
      endExpiratoryVolume: endExpiratoryVolumeL,
      thresholdVolume: heringBreuerThresholdL,
      kPrs: kPrsPerL,
    });
    const inspFlowDrive = inspiratoryFlowDrive({
      inspiratoryFlow: inspiratoryFlowLps,
      kInsp: kInspSecPerL,
    });

    last = Object.freeze({
      totalLungVolumeL,
      endExpiratoryVolumeL,
      excessVolumeAboveEndExpirationL:
        totalLungVolumeL - endExpiratoryVolumeL,
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
    snapshot,
    source: SOURCE,
  });
}

module.exports = Object.freeze({
  SOURCE,
  createHennigsMechanicalFeedbackCandidate,
});
