'use strict';
const assert = require('node:assert/strict');
const { createBerlinLiveHumModSession } = require('../src/clinical_twin_live_hummod_session.js');
function session({ dt = 0.002, rr = 22, pause = 0 } = {}) {
  const value = createBerlinLiveHumModSession({
    caseId: 'berlin-moderate-moderate-aspiration', dt,
    ventilation: { mode: 'VC_AC', fio2: 0.6, peep: 8, rr, vtL: 0.42, inspiratoryFlowLps: 0.7, inspiratoryPauseSec: pause },
    initialRecruitmentState: { normal: 1, recruitable: 0.35, consolidated: 0 },
  });
  value.initialize();
  return value;
}
let failures = 0;
function test(name, fn) {
  try { fn(); console.log('ok - ' + name); }
  catch (error) { failures++; console.error('FAIL - ' + name + ': ' + error.stack); }
}
test('zero-pause inspiratory hold completes at zero flow', () => {
  const live = session();
  const before = live.snapshot().timeSec;
  const held = live.requestInspiratoryHold(0.5);
  const measurement = held.pulmonary.measurements.inspiratoryHold;
  assert(held.timeSec > before);
  assert(Number.isFinite(measurement.plateauPressureCmH2O));
  assert(Math.abs(measurement.medianLateAirwayFlowLps) < 1e-8);
  assert.equal(live.simulation.pendingManeuver, null);
});
test('individual and combined holds tolerate accumulated mechanics-clock error', () => {
  const live = session({ rr: 20, pause: 0.2 });
  live.runFor(30);
  live.requestInspiratoryHold(0.5);
  live.requestExpiratoryHold(0.5);
  const held = live.performPassiveMechanicsMeasurement({ holdDurationSec: 0.5 });
  assert.equal(held.pulmonary.measurements.status, 'derived-from-explicit-zero-flow-holds');
  assert(Number.isFinite(held.systemic.gasExchange.pao2MmHg));
});
test('all UI solver timesteps support holds after a noninteger breath period', () => {
  for (const dt of [0.002, 0.001, 0.0005]) {
    const live = session({ dt });
    live.runFor(3);
    const systemicBefore = live.snapshot().timeSec;
    const mechanicsBefore = live.simulation.state.t;
    const held = live.performPassiveMechanicsMeasurement({ holdDurationSec: 0.5 });
    assert(Number.isFinite(held.pulmonary.measurements.drivingPressureCmH2O));
    const mechanicsElapsed = live.simulation.state.t - mechanicsBefore;
    assert(Math.abs((held.timeSec - systemicBefore) - mechanicsElapsed) < 1e-7, 'hold elapsed time was not preserved');
  }
});
process.exitCode = failures ? 1 : 0;
