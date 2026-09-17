'use strict';

const { derivePassiveRespiratoryMechanics } = require('../src/bedside_measurements.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log('ok -', name);
    passed += 1;
  } catch (e) {
    console.error('FAIL -', name, ':', e.message);
    failed += 1;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

function nearlyEqual(a, b, tol = 1e-12) {
  return Math.abs(a - b) <= tol;
}

test('requires both explicit hold measurements before deriving mechanics', () => {
  const result = derivePassiveRespiratoryMechanics({
    plateauPressureCmH2O: 24,
    setPeepCmH2O: 8,
  });
  assert(result.status === 'incomplete-hold-measurements');
  assert(result.intrinsicPeepCmH2O === null);
  assert(result.drivingPressureCmH2O === null);
});

test('derives intrinsic PEEP from total PEEP above set PEEP', () => {
  const result = derivePassiveRespiratoryMechanics({
    plateauPressureCmH2O: 24,
    totalPeepCmH2O: 11,
    setPeepCmH2O: 8,
    airwayOpeningPressureCmH2O: 4,
  });
  assert(nearlyEqual(result.intrinsicPeepCmH2O, 3));
  assert(nearlyEqual(result.effectiveEndExpiratoryReferenceCmH2O, 11));
  assert(nearlyEqual(result.drivingPressureCmH2O, 13));
});

test('airway-opening pressure can become the effective end-expiratory reference', () => {
  const result = derivePassiveRespiratoryMechanics({
    plateauPressureCmH2O: 22,
    totalPeepCmH2O: 7,
    setPeepCmH2O: 5,
    airwayOpeningPressureCmH2O: 9,
  });
  assert(nearlyEqual(result.intrinsicPeepCmH2O, 2));
  assert(nearlyEqual(result.effectiveEndExpiratoryReferenceCmH2O, 9));
  assert(nearlyEqual(result.drivingPressureCmH2O, 13));
});

test('intrinsic PEEP is not allowed to become negative from numerical mismatch', () => {
  const result = derivePassiveRespiratoryMechanics({
    plateauPressureCmH2O: 20,
    totalPeepCmH2O: 7.999999999,
    setPeepCmH2O: 8,
    airwayOpeningPressureCmH2O: 4,
  });
  assert(result.intrinsicPeepCmH2O === 0);
  assert(nearlyEqual(result.effectiveEndExpiratoryReferenceCmH2O, 8));
});

test('provenance identifies measured and modeled inputs separately', () => {
  const result = derivePassiveRespiratoryMechanics({
    plateauPressureCmH2O: 24,
    totalPeepCmH2O: 10,
    setPeepCmH2O: 8,
    airwayOpeningPressureCmH2O: 4,
  });
  assert(result.status === 'derived-from-explicit-zero-flow-holds');
  assert(result.provenance.plateau.includes('inspiratory hold'));
  assert(result.provenance.totalPeep.includes('expiratory hold'));
  assert(result.provenance.airwayOpeningPressure.includes('phenotype'));
});

console.log(`\nTests: passed=${passed} failed=${failed}`);
process.exit(failed === 0 ? 0 : 1);
