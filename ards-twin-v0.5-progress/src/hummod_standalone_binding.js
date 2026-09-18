'use strict';

// hummod_standalone_binding.js
//
// Builds a normalized HumMod snapshot mapper from an explicitly declared
// export schema while enforcing the pinned standalone source manifest.
//
// This module deliberately separates two identities:
//   1. HumMod source symbol (verified from the pinned .DES source), and
//   2. serialized export path (defined by the runtime/exporter we control).
//
// They are not assumed to be the same string or object shape.

const { createHumModSnapshotMapper } = require('./hummod_adapter.js');
const {
  HUMMOD_STANDALONE_UPSTREAM,
  HUMMOD_STANDALONE_SYMBOLS,
  listVerifiedDirectMappings,
} = require('./hummod_standalone_manifest.js');

function nonEmptyString(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

/**
 * Create a mapper for a concrete HumMod standalone export schema.
 *
 * exportPaths is keyed by exact HumMod source symbol, not normalized target:
 * {
 *   'PO2Artys.Pressure': 'model.PO2Artys.Pressure',
 *   ...
 * }
 *
 * timestampPath is owned by the execution/export envelope because the pinned
 * physiological source manifest does not claim a HumMod timestamp symbol.
 */
function createHumModStandaloneExportMapper({
  hummodRevision,
  exporterVersion,
  timestampPath,
  exportPaths,
  requiredTargets = ['timestampSec'],
  subjectId = null,
  runId = null,
} = {}) {
  if (hummodRevision !== HUMMOD_STANDALONE_UPSTREAM.revision) {
    throw new Error(
      `HumMod revision mismatch: expected ${HUMMOD_STANDALONE_UPSTREAM.revision}, got ${hummodRevision || 'missing'}`);
  }
  nonEmptyString(exporterVersion, 'exporterVersion');
  nonEmptyString(timestampPath, 'timestampPath');
  if (!exportPaths || typeof exportPaths !== 'object') {
    throw new Error('exportPaths mapping is required');
  }

  const fields = { timestampSec: timestampPath };
  for (const mapping of listVerifiedDirectMappings()) {
    const serializedPath = exportPaths[mapping.symbol];
    if (serializedPath !== undefined) {
      fields[mapping.target] = nonEmptyString(
        serializedPath,
        `export path for ${mapping.symbol}`);
    }
  }

  // Reject bindings for unverified or intentionally pending HumMod symbols.
  const allowedSymbols = new Set(listVerifiedDirectMappings().map(m => m.symbol));
  Object.keys(exportPaths).forEach(symbol => {
    if (!allowedSymbols.has(symbol)) {
      const knownPending = Object.values(HUMMOD_STANDALONE_SYMBOLS)
        .some(entry => entry.symbol === symbol);
      if (knownPending) {
        throw new Error(`HumMod symbol is not approved for direct normalization: ${symbol}`);
      }
      throw new Error(`unverified HumMod source symbol: ${symbol}`);
    }
  });

  return createHumModSnapshotMapper({
    modelVersion: `${HUMMOD_STANDALONE_UPSTREAM.repository}@${hummodRevision}; exporter=${exporterVersion}`,
    fields,
    requiredTargets,
    subjectId,
    runId,
  });
}

module.exports = { createHumModStandaloneExportMapper };
