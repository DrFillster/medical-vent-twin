'use strict';

// hummod_runner_contract.js
//
// Contract between Vent and an external HumMod execution/export process.
// It deliberately does not execute HumMod, convert System.X, or invent values.
//
// The runner request is expressed in Vent-facing seconds. For the pinned
// standalone revision, System.X is verified to use minutes: GoFor.DES maps
// 0.0166666 -> 1 Sec, 1 -> 1 Min, and 1440 -> 1 Day; HumMod's schema
// documentation independently uses 1440 as a one-day solution interval.

const {
  HUMMOD_STANDALONE_UPSTREAM,
  listVerifiedDirectMappings,
} = require('./hummod_standalone_manifest.js');

const HUMMOD_RUN_REQUEST_SCHEMA = 'vent-hummod-run-request/v1';

const HUMMOD_SOURCE_CLOCK = Object.freeze({
  symbol: 'System.X',
  unit: 'minute',
  secondsPerUnit: 60,
  verificationStatus: 'verified-for-pinned-revision',
  verificationSources: Object.freeze([
    'riliescu/hummod-standalone@8dab57e05631f779bf5020fe0dd51874d8ae98c1:Control/GoFor.DES',
    'HumMod/documentation@1cd093c001ea5af72e666a20e51542dce2304b38:schema/3_control/interactive.html',
  ]),
  conversionToTimestampSec: 'timestampSec = System.X * 60',
});

function nonEmptyString(value, label) {
  if (typeof value !== 'string' || !value) {
    throw new Error(label + ' must be a non-empty string');
  }
  return value;
}

function positive(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(label + ' must be a finite positive number');
  }
  return value;
}

function verifiedSymbols() {
  return listVerifiedDirectMappings().map(m => m.symbol);
}

function createHumModRunRequest({
  trajectoryId,
  durationSec,
  sampleIntervalSec,
  symbols = verifiedSymbols(),
  scenarioId = null,
  notes = null,
} = {}) {
  nonEmptyString(trajectoryId, 'trajectoryId');
  positive(durationSec, 'durationSec');
  positive(sampleIntervalSec, 'sampleIntervalSec');
  if (sampleIntervalSec > durationSec) {
    throw new Error('sampleIntervalSec must not exceed durationSec');
  }
  if (!Array.isArray(symbols) || symbols.length === 0) {
    throw new Error('symbols must be a non-empty array');
  }

  const allowed = new Set(verifiedSymbols());
  const seen = new Set();
  const requested = symbols.map(symbol => {
    nonEmptyString(symbol, 'symbol');
    if (!allowed.has(symbol)) {
      throw new Error('symbol is not verified for direct HumMod export: ' + symbol);
    }
    if (seen.has(symbol)) throw new Error('duplicate requested symbol: ' + symbol);
    seen.add(symbol);
    return symbol;
  });

  return Object.freeze({
    schema: HUMMOD_RUN_REQUEST_SCHEMA,
    trajectoryId,
    source: Object.freeze({
      repository: HUMMOD_STANDALONE_UPSTREAM.repository,
      revision: HUMMOD_STANDALONE_UPSTREAM.revision,
    }),
    requestedOutput: Object.freeze({
      durationSec,
      sampleIntervalSec,
      symbols: Object.freeze(requested),
      canonicalSchema: 'vent-hummod-trajectory/v1',
    }),
    sourceClock: HUMMOD_SOURCE_CLOCK,
    scenarioId: typeof scenarioId === 'string' && scenarioId ? scenarioId : null,
    notes: typeof notes === 'string' && notes ? notes : null,
    executable: true,
    blocker: null,
  });
}

function assertRunnerClockVerified(request, clockVerification = HUMMOD_SOURCE_CLOCK) {
  if (!request || request.schema !== HUMMOD_RUN_REQUEST_SCHEMA) {
    throw new Error('valid HumMod run request is required');
  }
  if (!clockVerification || typeof clockVerification !== 'object') {
    throw new Error('clockVerification is required');
  }

  const unit = clockVerification.unit || clockVerification.sourceClockUnit;
  const secondsPerUnit = clockVerification.secondsPerUnit;
  if (unit !== HUMMOD_SOURCE_CLOCK.unit || secondsPerUnit !== HUMMOD_SOURCE_CLOCK.secondsPerUnit) {
    throw new Error('clock verification does not match the pinned HumMod System.X contract');
  }

  return request;
}

module.exports = {
  HUMMOD_RUN_REQUEST_SCHEMA,
  HUMMOD_SOURCE_CLOCK,
  createHumModRunRequest,
  assertRunnerClockVerified,
};
