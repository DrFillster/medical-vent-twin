'use strict';

const { Simulation, VcAcController, ManeuverKind } = require('../src/simulation.js');
const { PRESETS } = require('../src/presets.js');
const { makePatientParams } = require('../src/contracts.js');

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

function makeStandardSimulation({ pause = 0.2 } = {}) {
  const params = makePatientParams(PRESETS.phenotype_moderate_recruitability());
  const controller = new VcAcController({
    fio2: 0.6,
    peep: 8,
    rr: 20,
    vt: 0.42,
    inspiratoryFlow: 0.7,
    inspiratoryPause: pause,
  });
  return new Simulation({
    params,
    controller,
    dt: 0.002,
    trackGas: false,
    initialPEEP: 8,
    initialRecruitmentState: {
      normal: 1,
      recruitable: 0.35,
      consolidated: 0,
    },
  });
}

function makeHighResistanceSimulation() {
  const base = PRESETS.phenotype_low_recruitability();
  const params = makePatientParams({
    ...base,
    centralAirwayResistance: 20,
    compartments: base.compartments.map(c => ({
      ...c,
      resistance: c.resistance * 8,
    })),
  });
  const controller = new VcAcController({
    fio2: 0.6,
    peep: 5,
    rr: 35,
    vt: 0.42,
    inspiratoryFlow: 0.7,
    inspiratoryPause: 0.1,
  });
  return new Simulation({
    params,
    controller,
    dt: 0.002,
    trackGas: false,
    initialPEEP: 5,
    initialRecruitmentState: {
      normal: 1,
      recruitable: 0.25,
      consolidated: 0,
    },
  });
}

test('inspiratory hold produces an explicit plateau-pressure measurement', () => {
  const sim = makeStandardSimulation();
  sim.requestInspiratoryHold(0.3);
  sim.runFor(1.5);

  const m = sim.measurements.find(x => x.kind === ManeuverKind.INSPIRATORY_HOLD);
  assert(m, 'expected completed inspiratory hold measurement');
  assert(Number.isFinite(m.plateauPressureCmH2O), 'plateau pressure must be finite');
  assert(m.plateauPressureCmH2O > 8, 'plateau should exceed set PEEP in this passive test lung');
  assert(Math.abs(m.medianLateAirwayFlowLps) < 1e-8,
    `hold flow should be zero, got ${m.medianLateAirwayFlowLps}`);
  assert(m.source.includes('zero-flow airway occlusion'), 'measurement provenance must be explicit');
});

test('expiratory hold waits until end expiration and measures total PEEP', () => {
  const sim = makeStandardSimulation();
  sim.requestExpiratoryHold(0.3);
  sim.runFor(3.8);

  const m = sim.measurements.find(x => x.kind === ManeuverKind.EXPIRATORY_HOLD);
  assert(m, 'expected completed expiratory hold measurement');
  assert(Number.isFinite(m.totalPeepCmH2O), 'total PEEP must be finite');
  assert(m.totalPeepCmH2O >= 0, 'total PEEP cannot be negative');
  assert(m.setPeepCmH2O === 8, 'set PEEP at measurement must be preserved');
  assert(Math.abs(m.medianLateAirwayFlowLps) < 1e-8,
    `hold flow should be zero, got ${m.medianLateAirwayFlowLps}`);
  assert(m.startedAtSec > m.requestedAtSec,
    'expiratory hold should wait for an end-expiratory measurement point');
});

test('high-resistance case exposes intrinsic pressure during expiratory hold', () => {
  const sim = makeHighResistanceSimulation();
  sim.requestExpiratoryHold(0.5);
  sim.runFor(2.8);

  const m = sim.measurements.find(x => x.kind === ManeuverKind.EXPIRATORY_HOLD);
  assert(m, 'expected completed expiratory hold measurement');
  assert(m.totalPeepCmH2O > m.setPeepCmH2O + 0.1,
    `expected trapped-pressure signal above set PEEP; total=${m.totalPeepCmH2O}, set=${m.setPeepCmH2O}`);
});

test('only one bedside maneuver may be pending or active at a time', () => {
  const sim = makeStandardSimulation();
  sim.requestInspiratoryHold(0.2);
  let threw = false;
  try { sim.requestExpiratoryHold(0.2); } catch (_) { threw = true; }
  assert(threw, 'second maneuver should be rejected while first is pending');
});

test('measurementSummary remains incomplete until explicit holds are available', () => {
  const sim = makeStandardSimulation();
  const summary = sim.measurementSummary();
  assert(summary.plateauPressureCmH2O === null);
  assert(summary.totalPeepCmH2O === null);
  assert(summary.drivingPressureCmH2O === null);
  assert(summary.drivingPressureStatus === 'incomplete-hold-measurements');
});

test('measurementSummary derives mechanics only after explicit inspiratory and expiratory holds', () => {
  const sim = makeStandardSimulation();
  sim.requestInspiratoryHold(0.3);
  sim.runFor(1.5);
  sim.requestExpiratoryHold(0.3);
  sim.runFor(2.5);

  const summary = sim.measurementSummary();
  assert(Number.isFinite(summary.plateauPressureCmH2O), 'plateau should be measured');
  assert(Number.isFinite(summary.totalPeepCmH2O), 'total PEEP should be measured');
  assert(Number.isFinite(summary.drivingPressureCmH2O), 'driving pressure should be derived from holds');
  assert(summary.drivingPressureStatus === 'derived-from-explicit-zero-flow-holds');
  assert(summary.provenance && summary.provenance.derivation === 'passive respiratory mechanics');
});

console.log(`\nTests: passed=${passed} failed=${failed}`);
process.exit(failed === 0 ? 0 : 1);
