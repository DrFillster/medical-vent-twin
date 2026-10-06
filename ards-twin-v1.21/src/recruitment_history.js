'use strict';

// recruitment_history.js
//
// Deterministic initialization history for the recruitable compartment.
//
// This is intentionally narrower than a full pre-simulation ventilator replay.
// Each history segment represents a sustained, zero-flow-equilibrated airway
// pressure, so alveolar pressure is treated as equal to the declared segment
// pressure. Recruitment kinetics are then integrated with the same
// recruitment.js law used by the mechanics engine.
//
// The history MUST declare an earlier starting recruitable fraction. The model
// does not infer that value from Berlin severity, compliance, etiology, or PEEP.

const { stepRecruitment } = require('./recruitment.js');

const RECRUITMENT_HISTORY_SCHEMA = 'vent-recruitment-history/v1';

function finite(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(label + ' must be a finite number');
  }
  return value;
}

function fraction(value, label) {
  finite(value, label);
  if (value < 0 || value > 1) throw new Error(label + ' must be in [0,1]');
  return value;
}

function positive(value, label) {
  finite(value, label);
  if (!(value > 0)) throw new Error(label + ' must be > 0');
  return value;
}

function nonNegative(value, label) {
  finite(value, label);
  if (value < 0) throw new Error(label + ' must be non-negative');
  return value;
}

function validateRecruitmentHistory(history) {
  if (!history || typeof history !== 'object' || Array.isArray(history)) {
    throw new Error('recruitment history must be an object');
  }
  if (history.schema !== RECRUITMENT_HISTORY_SCHEMA) {
    throw new Error('unsupported recruitment history schema: ' + String(history.schema || 'missing'));
  }

  fraction(history.startingRecruitableFraction, 'startingRecruitableFraction');
  if (typeof history.startingStateSource !== 'string' || !history.startingStateSource) {
    throw new Error('startingStateSource is required');
  }
  if (!Array.isArray(history.segments) || history.segments.length === 0) {
    throw new Error('history.segments must be a non-empty array');
  }

  history.segments.forEach((segment, index) => {
    if (!segment || typeof segment !== 'object' || Array.isArray(segment)) {
      throw new Error('history segment ' + index + ' must be an object');
    }
    nonNegative(segment.pressureCmH2O, 'history segment ' + index + ' pressureCmH2O');
    positive(segment.durationSec, 'history segment ' + index + ' durationSec');
    if (segment.note != null && typeof segment.note !== 'string') {
      throw new Error('history segment ' + index + ' note must be a string when supplied');
    }
  });

  return history;
}

function deriveRecruitmentFromHistory({
  history,
  recruitableCompartmentParams,
  airwayOpeningPressureCmH2O,
  integrationStepSec = 0.02,
} = {}) {
  validateRecruitmentHistory(history);
  if (!recruitableCompartmentParams ||
      recruitableCompartmentParams.id !== 'recruitable') {
    throw new Error('recruitableCompartmentParams for the recruitable compartment are required');
  }
  nonNegative(airwayOpeningPressureCmH2O, 'airwayOpeningPressureCmH2O');
  positive(integrationStepSec, 'integrationStepSec');

  let r = history.startingRecruitableFraction;
  let elapsedSec = 0;
  const segmentResults = [];

  history.segments.forEach((segment, index) => {
    let remaining = segment.durationSec;
    const start = r;
    while (remaining > 1e-12) {
      const dt = Math.min(integrationStepSec, remaining);
      r = stepRecruitment(
        r,
        segment.pressureCmH2O,
        dt,
        recruitableCompartmentParams,
        airwayOpeningPressureCmH2O
      );
      remaining -= dt;
      elapsedSec += dt;
    }
    segmentResults.push(Object.freeze({
      index,
      pressureCmH2O: segment.pressureCmH2O,
      durationSec: segment.durationSec,
      startRecruitableFraction: start,
      endRecruitableFraction: r,
      note: segment.note || null,
    }));
  });

  return Object.freeze({
    schema: 'vent-derived-recruitment-state/v1',
    initialRecruitmentState: Object.freeze({
      normal: 1,
      recruitable: r,
      consolidated: 0,
    }),
    elapsedHistorySec: elapsedSec,
    startingRecruitableFraction: history.startingRecruitableFraction,
    startingStateSource: history.startingStateSource,
    integrationStepSec,
    segmentResults: Object.freeze(segmentResults),
    provenance: Object.freeze({
      law: 'Vent recruitment.js kinetics',
      pressureInterpretation: 'sustained zero-flow-equilibrated airway pressure treated as alveolar pressure',
      airwayOpeningPressureCmH2O,
      status: 'derived-from-explicit-initialization-history',
    }),
  });
}

module.exports = {
  RECRUITMENT_HISTORY_SCHEMA,
  validateRecruitmentHistory,
  deriveRecruitmentFromHistory,
};
