'use strict';

// clinical_units.js
//
// Small, explicit unit bridge for cross-engine coupling.
// Pressure conversion is intentionally isolated from HumMod physiology so
// source-native hemodynamic modules remain in mmHg.
const CMH2O_TO_MMHG = 0.7356;

function cmH2OToMmHg(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('cmH2O value must be finite');
  }
  return value * CMH2O_TO_MMHG;
}

module.exports = {
  CMH2O_TO_MMHG,
  cmH2OToMmHg,
};
