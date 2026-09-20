'use strict';

// hummod_raw_series_adapter.js
//
// Converts exact HumMod raw-series rows into Vent's canonical trajectory schema.
// Raw rows preserve the HumMod runtime clock (System.X) and exact source-symbol
// names. The canonical replay timeline is normalized to t=0 at the first sample.
//
// No source variable is renamed or guessed. Only symbols that have already been
// verified for direct export are accepted.

const {
  HUMMOD_STANDALONE_UPSTREAM,
  listVerifiedDirectMappings,
} = require('./hummod_standalone_manifest.js');
const {
  HUMMOD_SOURCE_CLOCK,
} = require('./hummod_runner_contract.js');
const {
  HUMMOD_EXPORT_SCHEMA,
  validateHumModTrajectoryExport,
} = require('./hummod_export_contract.js');

const HUMMOD_RAW_SERIES_SCHEMA = 'hummod-raw-series/v1';

function nonEmptyString(value, label) {
  if (typeof value !== 'string' || !value) throw new Error(label + ' must be a non-empty string');
  return value;
}

function finite(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(label + ' must be a finite number');
  }
  return value;
}

function directSymbols() {
  return listVerifiedDirectMappings().map(m => m.symbol);
}

function validateHumModRawSeries(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('HumMod raw series must be an object');
  }
  if (raw.schema !== HUMMOD_RAW_SERIES_SCHEMA) {
    throw new Error('unsupported HumMod raw series schema: ' + String(raw.schema || 'missing'));
  }
  const source = raw.source;
  if (!source || typeof source !== 'object') throw new Error('source metadata is required');
  if (source.repository !== HUMMOD_STANDALONE_UPSTREAM.repository) {
    throw new Error('unexpected HumMod repository: ' + String(source.repository || 'missing'));
  }
  if (source.revision !== HUMMOD_STANDALONE_UPSTREAM.revision) {
    throw new Error('HumMod revision mismatch');
  }
  nonEmptyString(source.exporterVersion, 'source.exporterVersion');
  nonEmptyString(raw.trajectoryId, 'trajectoryId');

  if (!raw.clock || raw.clock.symbol !== HUMMOD_SOURCE_CLOCK.symbol ||
      raw.clock.unit !== HUMMOD_SOURCE_CLOCK.unit) {
    throw new Error('raw series clock must be verified System.X in minutes');
  }

  if (!Array.isArray(raw.symbols) || raw.symbols.length === 0) {
    throw new Error('symbols must be a non-empty array');
  }
  const allowed = new Set(directSymbols());
  const declared = new Set();
  raw.symbols.forEach(symbol => {
    nonEmptyString(symbol, 'symbols entry');
    if (!allowed.has(symbol)) throw new Error('unverified HumMod symbol: ' + symbol);
    if (declared.has(symbol)) throw new Error('duplicate HumMod symbol: ' + symbol);
    declared.add(symbol);
  });

  if (!Array.isArray(raw.rows) || raw.rows.length === 0) {
    throw new Error('rows must contain at least one raw sample');
  }

  let previousClock = -Infinity;
  raw.rows.forEach((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      throw new Error('row ' + index + ' must be an object');
    }
    const x = finite(row[HUMMOD_SOURCE_CLOCK.symbol],
      'row ' + index + ' ' + HUMMOD_SOURCE_CLOCK.symbol);
    if (x < 0) throw new Error('row ' + index + ' source clock must be non-negative');
    if (x <= previousClock) throw new Error('raw HumMod clock must be strictly increasing');
    previousClock = x;

    Object.keys(row).forEach(key => {
      if (key !== HUMMOD_SOURCE_CLOCK.symbol && !declared.has(key)) {
        throw new Error('row ' + index + ' contains undeclared symbol: ' + key);
      }
    });
    raw.symbols.forEach(symbol => {
      if (!Object.prototype.hasOwnProperty.call(row, symbol)) {
        throw new Error('row ' + index + ' missing declared symbol: ' + symbol);
      }
      finite(row[symbol], 'row ' + index + ' symbol ' + symbol);
    });
  });

  return raw;
}

function convertHumModRawSeries(raw) {
  validateHumModRawSeries(raw);
  const firstClock = raw.rows[0][HUMMOD_SOURCE_CLOCK.symbol];

  const canonical = {
    schema: HUMMOD_EXPORT_SCHEMA,
    trajectoryId: raw.trajectoryId,
    source: {
      repository: raw.source.repository,
      revision: raw.source.revision,
      exporterVersion: raw.source.exporterVersion,
    },
    symbols: raw.symbols.slice(),
    sourceClock: {
      ...HUMMOD_SOURCE_CLOCK,
      rawStart: firstClock,
      canonicalTimelineOrigin: 'first-raw-sample',
    },
    nativeSolution: raw.nativeSolution ? {
      format: raw.nativeSolution.format,
      index: raw.nativeSolution.index,
      sampleCount: raw.nativeSolution.sampleCount,
      variableCount: raw.nativeSolution.variableCount,
      reducedState: raw.nativeSolution.reducedState || {},
      scenarioApplied: raw.nativeSolution.scenarioApplied,
      scenario: raw.nativeSolution.scenario,
    } : null,
    rows: raw.rows.map(row => {
      const rawClock = row[HUMMOD_SOURCE_CLOCK.symbol];
      const timestampSec =
        (rawClock - firstClock) * HUMMOD_SOURCE_CLOCK.secondsPerUnit;
      const values = {};
      raw.symbols.forEach(symbol => { values[symbol] = row[symbol]; });
      return {
        timestampSec,
        sourceClockValue: rawClock,
        values,
      };
    }),
  };

  validateHumModTrajectoryExport(canonical);
  return canonical;
}

module.exports = {
  HUMMOD_RAW_SERIES_SCHEMA,
  validateHumModRawSeries,
  convertHumModRawSeries,
};
