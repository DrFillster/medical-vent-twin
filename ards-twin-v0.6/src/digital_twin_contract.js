'use strict';

// digital_twin_contract.js — source-neutral interface between the ventilator
// simulator and an external whole-body / digital-twin physiology provider.
//
// This contract intentionally does NOT contain HumMod-specific variable names,
// equations, source code, or file formats. A provider adapter may map HumMod,
// a research dataset, a bench model, or another physiology engine into this
// schema without coupling the core ventilator simulator to that source.

const TWIN_SCHEMA_VERSION = '1.0.0';

function finiteOrNull(value, path) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${path} must be a finite number or null`);
  }
  return value;
}

function fractionOrNull(value, path) {
  const v = finiteOrNull(value, path);
  if (v === null) return null;
  if (v < 0 || v > 1) throw new Error(`${path} must be in [0,1]`);
  return v;
}

function nonNegativeOrNull(value, path) {
  const v = finiteOrNull(value, path);
  if (v === null) return null;
  if (v < 0) throw new Error(`${path} must be non-negative`);
  return v;
}

function stringOrNull(value) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Normalize a provider sample into the Vent digital-twin interchange schema.
 * Missing domains are represented as null rather than guessed.
 *
 * No clinical inference is performed here. This is only a typed data boundary.
 */
function makeTwinSnapshot(input = {}) {
  const respiratory = input.respiratory || {};
  const gasExchange = input.gasExchange || {};
  const hemodynamics = input.hemodynamics || {};
  const metabolism = input.metabolism || {};

  const timestampSec = nonNegativeOrNull(input.timestampSec, 'timestampSec');
  if (timestampSec === null) throw new Error('timestampSec is required');

  return Object.freeze({
    schemaVersion: TWIN_SCHEMA_VERSION,
    source: Object.freeze({
      provider: typeof input.provider === 'string' ? input.provider : 'unknown',
      modelVersion: stringOrNull(input.modelVersion),
      subjectId: stringOrNull(input.subjectId),
      runId: stringOrNull(input.runId),
    }),
    timestampSec,
    respiratory: Object.freeze({
      complianceMlPerCmH2O: nonNegativeOrNull(
        respiratory.complianceMlPerCmH2O, 'respiratory.complianceMlPerCmH2O'),
      airwayResistanceCmH2OPerLps: nonNegativeOrNull(
        respiratory.airwayResistanceCmH2OPerLps, 'respiratory.airwayResistanceCmH2OPerLps'),
      shuntFraction: fractionOrNull(respiratory.shuntFraction, 'respiratory.shuntFraction'),
      deadSpaceFraction: fractionOrNull(
        respiratory.deadSpaceFraction, 'respiratory.deadSpaceFraction'),
      recruitabilityIndex: fractionOrNull(
        respiratory.recruitabilityIndex, 'respiratory.recruitabilityIndex'),
    }),
    gasExchange: Object.freeze({
      pao2MmHg: nonNegativeOrNull(gasExchange.pao2MmHg, 'gasExchange.pao2MmHg'),
      paco2MmHg: nonNegativeOrNull(gasExchange.paco2MmHg, 'gasExchange.paco2MmHg'),
      ph: finiteOrNull(gasExchange.ph, 'gasExchange.ph'),
      spo2Fraction: fractionOrNull(gasExchange.spo2Fraction, 'gasExchange.spo2Fraction'),
    }),
    hemodynamics: Object.freeze({
      heartRatePerMin: nonNegativeOrNull(
        hemodynamics.heartRatePerMin, 'hemodynamics.heartRatePerMin'),
      meanArterialPressureMmHg: finiteOrNull(
        hemodynamics.meanArterialPressureMmHg, 'hemodynamics.meanArterialPressureMmHg'),
      cardiacOutputLPerMin: nonNegativeOrNull(
        hemodynamics.cardiacOutputLPerMin, 'hemodynamics.cardiacOutputLPerMin'),
      centralVenousPressureMmHg: finiteOrNull(
        hemodynamics.centralVenousPressureMmHg, 'hemodynamics.centralVenousPressureMmHg'),
    }),
    metabolism: Object.freeze({
      oxygenConsumptionMlPerMin: nonNegativeOrNull(
        metabolism.oxygenConsumptionMlPerMin, 'metabolism.oxygenConsumptionMlPerMin'),
      co2ProductionMlPerMin: nonNegativeOrNull(
        metabolism.co2ProductionMlPerMin, 'metabolism.co2ProductionMlPerMin'),
    }),
  });
}

/**
 * Minimal runtime contract for an external provider adapter.
 * Providers remain responsible for their own model initialization and solver.
 */
function validateTwinProvider(provider) {
  if (!provider || typeof provider !== 'object') {
    throw new Error('digital twin provider must be an object');
  }
  ['initialize', 'sample', 'applyIntervention'].forEach(method => {
    if (typeof provider[method] !== 'function') {
      throw new Error(`digital twin provider must implement ${method}()`);
    }
  });
  return true;
}

module.exports = {
  TWIN_SCHEMA_VERSION,
  makeTwinSnapshot,
  validateTwinProvider,
};
