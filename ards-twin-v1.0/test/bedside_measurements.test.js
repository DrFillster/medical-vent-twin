'use strict';

const {
  derivePassiveRespiratoryMechanics,
  summarizeSimulationMeasurements,
} = require('../src/bedside_measurements.js');

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

test('simulation summary uses the latest hold of each type and modeled AOP', () => {
  const simulation = {
    params: { airwayOpeningPressure: 9 },
    measurements: [
      { kind: 'INSPIRATORY_HOLD', plateauPressureCmH2O: 20, startedAtSec: 1 },
      { kind: 'EXPIRATORY_HOLD', totalPeepCmH2O: 8, setPeepCmH2O: 5, startedAtSec: 2 },
      { kind: 'INSPIRATORY_HOLD', plateauPressureCmH2O: 23, startedAtSec: 3 },
    ],
  };
  const result = summarizeSimulationMeasurements(simulation);
  assert(result.inspiratoryHold.startedAtSec === 3, 'latest inspiratory hold should win');
  assert(result.expiratoryHold.startedAtSec === 2, 'latest expiratory hold should win');
  assert(nearlyEqual(result.effectiveEndExpiratoryReferenceCmH2O, 9));
  assert(nearlyEqual(result.drivingPressureCmH2O, 14));
});


test('simulation summary exposes latest breath peak airway pressure', () => {
  const simulation = {
    params: { airwayOpeningPressure: 4 },
    measurements: [],
    metrics() {
      return [
        { Ppeak: 28, PEEP: 8, breathIndex: 0 },
        { Ppeak: 31, PEEP: 10, breathIndex: 1 },
      ];
    },
  };
  const result = summarizeSimulationMeasurements(simulation);
  assert(nearlyEqual(result.peakPressureCmH2O, 31));
  assert(nearlyEqual(result.breathPeepCmH2O, 10));
  assert(result.latestBreath.breathIndex === 1);
});

test('holds from previous ventilator settings cannot supply current pressures', () => {
  const simulation = {
    params: { airwayOpeningPressure: 4 },
    interventions: [
      { kind: 'REQUEST_CONTROLLER_CHANGE', t: 8 },
      { kind: 'APPLY_CONTROLLER_CHANGE', t: 10 },
    ],
    measurements: [
      { kind: 'INSPIRATORY_HOLD', startedAtSec: 4, plateauPressureCmH2O: 14 },
      { kind: 'EXPIRATORY_HOLD', startedAtSec: 6, totalPeepCmH2O: 4, setPeepCmH2O: 3 },
    ],
  };
  let result = summarizeSimulationMeasurements(simulation);
  assert(result.plateauPressureCmH2O === null);
  assert(result.totalPeepCmH2O === null);
  assert(result.drivingPressureCmH2O === null);
  assert(result.inspiratoryHold.plateauPressureCmH2O === 14, 'history is retained');
  simulation.measurements.push({ kind: 'INSPIRATORY_HOLD', startedAtSec: 11, plateauPressureCmH2O: 20 });
  result = summarizeSimulationMeasurements(simulation);
  assert(result.plateauPressureCmH2O === 20);
  assert(result.drivingPressureCmH2O === null, 'new plateau must not use old total PEEP');
  simulation.measurements.push({ kind: 'EXPIRATORY_HOLD', startedAtSec: 12, totalPeepCmH2O: 8, setPeepCmH2O: 8 });
  result = summarizeSimulationMeasurements(simulation);
  assert(result.drivingPressureCmH2O === 12);
  assert(!result.staleInspiratoryHold && !result.staleExpiratoryHold);
  simulation.interventions.push({ kind: 'SET_PEEP', t: 13 });
  assert(summarizeSimulationMeasurements(simulation).drivingPressureCmH2O === null);
});

test('a queued ventilator change does not invalidate holds before application', () => {
  const result = summarizeSimulationMeasurements({
    interventions: [{ kind: 'REQUEST_CONTROLLER_CHANGE', t: 10 }],
    measurements: [
      { kind: 'INSPIRATORY_HOLD', startedAtSec: 4, plateauPressureCmH2O: 20 },
      { kind: 'EXPIRATORY_HOLD', startedAtSec: 6, totalPeepCmH2O: 8, setPeepCmH2O: 8 },
    ],
  });
  assert(result.drivingPressureCmH2O === 12);
});

console.log(`\nTests: passed=${passed} failed=${failed}`);
process.exit(failed === 0 ? 0 : 1);
