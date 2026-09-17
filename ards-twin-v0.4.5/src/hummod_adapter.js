'use strict';

// hummod_adapter.js — explicit, versioned boundary for HumMod-derived state.
//
// This module intentionally contains no hard-coded HumMod variable names.
// Callers must supply verified source paths for the exact HumMod revision/export
// being used. This prevents fuzzy/nearest-name mapping from becoming physiology.

const { makeTwinSnapshot } = require('./digital_twin_contract.js');

const TARGET_FIELDS = Object.freeze([
  'timestampSec',
  'respiratory.complianceMlPerCmH2O',
  'respiratory.airwayResistanceCmH2OPerLps',
  'respiratory.shuntFraction',
  'respiratory.deadSpaceFraction',
  'respiratory.recruitabilityIndex',
  'gasExchange.pao2MmHg',
  'gasExchange.paco2MmHg',
  'gasExchange.ph',
  'gasExchange.spo2Fraction',
  'hemodynamics.heartRatePerMin',
  'hemodynamics.meanArterialPressureMmHg',
  'hemodynamics.cardiacOutputLPerMin',
  'hemodynamics.centralVenousPressureMmHg',
  'metabolism.oxygenConsumptionMlPerMin',
  'metabolism.co2ProductionMlPerMin',
]);

function getPath(source, path) {
  if (typeof path !== 'string' || path.length === 0) return undefined;
  return path.split('.').reduce((value, key) =>
    value !== null && value !== undefined ? value[key] : undefined, source);
}

function setPath(target, path, value) {
  const parts = path.split('.');
  let cursor = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    if (!cursor[key]) cursor[key] = {};
    cursor = cursor[key];
  }
  cursor[parts[parts.length - 1]] = value;
}

function validateMapping(fields) {
  if (!fields || typeof fields !== 'object') throw new Error('fields mapping is required');
  const allowed = new Set(TARGET_FIELDS);
  Object.keys(fields).forEach(target => {
    if (!allowed.has(target)) throw new Error(`unsupported normalized target field: ${target}`);
    if (typeof fields[target] !== 'string' || !fields[target]) {
      throw new Error(`mapping for ${target} must be a non-empty exact source path`);
    }
  });
  if (!fields.timestampSec) throw new Error('mapping must include timestampSec');
}

/**
 * Create an exact-path mapper for one verified HumMod export/schema revision.
 * No unit conversion is performed. Source values must already use the units
 * required by digital_twin_contract.js.
 */
function createHumModSnapshotMapper({
  modelVersion,
  fields,
  requiredTargets = ['timestampSec'],
  subjectId = null,
  runId = null,
} = {}) {
  if (typeof modelVersion !== 'string' || !modelVersion) {
    throw new Error('modelVersion is required for HumMod mappings');
  }
  validateMapping(fields);
  if (!Array.isArray(requiredTargets)) throw new Error('requiredTargets must be an array');
  requiredTargets.forEach(target => {
    if (!Object.prototype.hasOwnProperty.call(fields, target)) {
      throw new Error(`required target is not mapped: ${target}`);
    }
  });

  return function mapHumModSnapshot(source) {
    if (!source || typeof source !== 'object') throw new Error('HumMod source snapshot must be an object');
    const normalized = {};

    Object.entries(fields).forEach(([target, sourcePath]) => {
      const value = getPath(source, sourcePath);
      if (value !== undefined) setPath(normalized, target, value);
    });

    requiredTargets.forEach(target => {
      const sourcePath = fields[target];
      if (getPath(source, sourcePath) === undefined) {
        throw new Error(`required HumMod source field missing: ${sourcePath} -> ${target}`);
      }
    });

    return makeTwinSnapshot({
      ...normalized,
      provider: 'HumMod',
      modelVersion,
      subjectId,
      runId,
    });
  };
}

function normalizeReplaySnapshots(snapshots) {
  if (!Array.isArray(snapshots) || snapshots.length === 0) {
    throw new Error('replay provider requires at least one normalized snapshot');
  }
  const ordered = snapshots.slice().sort((a, b) => a.timestampSec - b.timestampSec);
  ordered.forEach((snapshot, index) => {
    if (!snapshot || typeof snapshot.timestampSec !== 'number' || !Number.isFinite(snapshot.timestampSec)) {
      throw new Error(`invalid replay snapshot at index ${index}`);
    }
    if (index > 0 && snapshot.timestampSec === ordered[index - 1].timestampSec) {
      throw new Error(`duplicate replay timestamp: ${snapshot.timestampSec}`);
    }
  });
  return Object.freeze(ordered);
}

/**
 * Deterministic browser-compatible systemic replay provider.
 *
 * Interventions are rejected because a fixed trajectory cannot legitimately
 * synthesize a physiologic response that is not present in its source data.
 */
function createHumModReplayProvider({ snapshots, trajectoryId = null } = {}) {
  const ordered = normalizeReplaySnapshots(snapshots);
  let initialized = false;

  return Object.freeze({
    provider: 'HumMod-replay',
    trajectoryId,

    initialize() {
      initialized = true;
      return ordered[0];
    },

    sample(timestampSec) {
      if (!initialized) throw new Error('replay provider must be initialized before sampling');
      if (typeof timestampSec !== 'number' || !Number.isFinite(timestampSec) || timestampSec < 0) {
        throw new Error('timestampSec must be a finite non-negative number');
      }
      let selected = ordered[0];
      for (const snapshot of ordered) {
        if (snapshot.timestampSec > timestampSec) break;
        selected = snapshot;
      }
      return selected;
    },

    applyIntervention() {
      throw new Error('fixed HumMod replay cannot synthesize intervention responses; use an authored trajectory or live provider');
    },
  });
}

module.exports = {
  HUMMOD_NORMALIZED_TARGET_FIELDS: TARGET_FIELDS,
  createHumModSnapshotMapper,
  createHumModReplayProvider,
};
