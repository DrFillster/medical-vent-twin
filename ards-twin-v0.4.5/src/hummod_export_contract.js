'use strict';

// hummod_export_contract.js
//
// Canonical serialization contract for HumMod standalone trajectory exports.
// This file defines the JSON shape produced by a future HumMod runner/exporter
// and consumed by the browser/runtime. It does not contain physiologic values,
// does not execute HumMod, and does not infer source symbols.
//
// Design goals:
// - pin every trajectory to one upstream HumMod revision and exporter version
// - preserve exact HumMod source-symbol identity in every exported row
// - keep execution time in the export envelope rather than inventing a HumMod
//   physiological timestamp symbol
// - reject duplicate/non-monotonic timestamps
// - reject undeclared symbols so serialization cannot silently redefine the
//   physiology mapping
// - convert rows to normalized digital-twin snapshots only through the verified
//   standalone binding layer

const {
  HUMMOD_STANDALONE_UPSTREAM,
  listVerifiedDirectMappings,
} = require('./hummod_standalone_manifest.js');
const { createHumModStandaloneExportMapper } = require('./hummod_standalone_binding.js');
const { createHumModReplayProvider } = require('./hummod_adapter.js');

const HUMMOD_EXPORT_SCHEMA = 'vent-hummod-trajectory/v1';

function nonEmptyString(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function finiteNonNegative(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a finite non-negative number`);
  }
  return value;
}

function directSymbols() {
  return listVerifiedDirectMappings().map(m => m.symbol);
}

function validateHumModTrajectoryExport(exportObject) {
  if (!exportObject || typeof exportObject !== 'object' || Array.isArray(exportObject)) {
    throw new Error('HumMod trajectory export must be an object');
  }
  if (exportObject.schema !== HUMMOD_EXPORT_SCHEMA) {
    throw new Error(`unsupported HumMod export schema: ${exportObject.schema || 'missing'}`);
  }

  const source = exportObject.source;
  if (!source || typeof source !== 'object') throw new Error('source metadata is required');
  if (source.repository !== HUMMOD_STANDALONE_UPSTREAM.repository) {
    throw new Error(`unexpected HumMod repository: ${source.repository || 'missing'}`);
  }
  if (source.revision !== HUMMOD_STANDALONE_UPSTREAM.revision) {
    throw new Error(
      `HumMod revision mismatch: expected ${HUMMOD_STANDALONE_UPSTREAM.revision}, got ${source.revision || 'missing'}`);
  }
  nonEmptyString(source.exporterVersion, 'source.exporterVersion');
  nonEmptyString(exportObject.trajectoryId, 'trajectoryId');

  const declaredSymbols = exportObject.symbols;
  if (!Array.isArray(declaredSymbols) || declaredSymbols.length === 0) {
    throw new Error('symbols must be a non-empty array');
  }
  const allowed = new Set(directSymbols());
  const seen = new Set();
  declaredSymbols.forEach(symbol => {
    nonEmptyString(symbol, 'symbols entry');
    if (!allowed.has(symbol)) throw new Error(`symbol is not approved for direct export: ${symbol}`);
    if (seen.has(symbol)) throw new Error(`duplicate declared symbol: ${symbol}`);
    seen.add(symbol);
  });

  if (!Array.isArray(exportObject.rows) || exportObject.rows.length === 0) {
    throw new Error('rows must contain at least one trajectory sample');
  }

  let previousTime = -Infinity;
  exportObject.rows.forEach((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      throw new Error(`row ${index} must be an object`);
    }
    const t = finiteNonNegative(row.timestampSec, `row ${index} timestampSec`);
    if (t <= previousTime) {
      throw new Error(`trajectory timestamps must be strictly increasing at row ${index}`);
    }
    previousTime = t;
    if (!row.values || typeof row.values !== 'object' || Array.isArray(row.values)) {
      throw new Error(`row ${index} values object is required`);
    }

    Object.keys(row.values).forEach(symbol => {
      if (!seen.has(symbol)) {
        throw new Error(`row ${index} contains undeclared symbol: ${symbol}`);
      }
    });
    declaredSymbols.forEach(symbol => {
      if (!Object.prototype.hasOwnProperty.call(row.values, symbol)) {
        throw new Error(`row ${index} missing declared symbol: ${symbol}`);
      }
      const value = row.values[symbol];
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`row ${index} symbol ${symbol} must be a finite number`);
      }
    });
  });

  return exportObject;
}

function makeCanonicalExportPaths(symbols) {
  const paths = {};
  symbols.forEach(symbol => {
    paths[symbol] = `values.${symbol}`;
  });
  return paths;
}

function normalizeHumModTrajectoryExport(exportObject, { subjectId = null, runId = null } = {}) {
  validateHumModTrajectoryExport(exportObject);
  const exportPaths = makeCanonicalExportPaths(exportObject.symbols);
  const mapper = createHumModStandaloneExportMapper({
    hummodRevision: exportObject.source.revision,
    exporterVersion: exportObject.source.exporterVersion,
    timestampPath: 'timestampSec',
    exportPaths,
    requiredTargets: ['timestampSec'],
    subjectId,
    runId: runId || exportObject.trajectoryId,
  });
  return Object.freeze(exportObject.rows.map(row => mapper(row)));
}

function createReplayProviderFromHumModExport(exportObject, options = {}) {
  const snapshots = normalizeHumModTrajectoryExport(exportObject, options);
  return createHumModReplayProvider({
    snapshots,
    trajectoryId: exportObject.trajectoryId,
  });
}

module.exports = {
  HUMMOD_EXPORT_SCHEMA,
  validateHumModTrajectoryExport,
  normalizeHumModTrajectoryExport,
  createReplayProviderFromHumModExport,
};
