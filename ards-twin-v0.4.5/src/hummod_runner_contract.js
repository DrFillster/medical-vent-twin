'use strict';

// hummod_runner_contract.js
//
// Contract between Vent and an external HumMod execution/export process.
// It deliberately does not execute HumMod, convert System.X, or invent values.
//
// The runner request is expressed in Vent-facing seconds, but the external
// runner must independently verify HumMod source-clock semantics before it may
// emit a canonical vent-hummod-trajectory/v1 export.

const {
  HUMMOD_STANDALONE_UPSTREAM,
  listVerifiedDirectMappings,
} = require('./hummod_standalone_manifest.js');

const HUMMOD_RUN_REQUEST_SCHEMA = 'vent-hummod-run-request/v1';

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
    sourceClock: Object.freeze({
      symbol: 'System.X',
      unit: null,
      verificationStatus: 'must-be-verified-by-runner-before-export',
      conversionToTimestampSec: null,
    }),
    scenarioId: typeof scenarioId === 'string' && scenarioId ? scenarioId : null,
    notes: typeof notes === 'string' && notes ? notes : null,
    executable: false,
    blocker: 'HumMod source clock unit/semantics are not yet verified',
  });
}

function assertRunnerClockVerified(request, clockVerification) {
  if (!request || request.schema !== HUMMOD_RUN_REQUEST_SCHEMA) {
    throw new Error('valid HumMod run request is required');
  }
  if (!clockVerification || typeof clockVerification !== 'object') {
    throw new Error('clockVerification is required');
  }
  nonEmptyString(clockVerification.sourceClockUnit, 'clockVerification.sourceClockUnit');
  nonEmptyString(clockVerification.verificationSource, 'clockVerification.verificationSource');
  if (clockVerification.verified !== true) {
    throw new Error('HumMod source clock must be explicitly verified');
  }

  return Object.freeze({
    ...request,
    sourceClock: Object.freeze({
      symbol: 'System.X',
      unit: clockVerification.sourceClockUnit,
      verificationStatus: 'verified',
      verificationSource: clockVerification.verificationSource,
      conversionToTimestampSec: clockVerification.conversionToTimestampSec || null,
    }),
    executable: true,
    blocker: null,
  });
}

module.exports = {
  HUMMOD_RUN_REQUEST_SCHEMA,
  createHumModRunRequest,
  assertRunnerClockVerified,
};
