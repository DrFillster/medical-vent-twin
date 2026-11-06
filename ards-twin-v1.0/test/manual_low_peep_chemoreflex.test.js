'use strict';

const assert = require('node:assert/strict');
const { createBerlinLiveHumModSession } = require('../src/clinical_twin_live_hummod_session.js');

// The ordinary bedside startup uses this mode, including the unchanged
// 30-second mechanical warmup. This reproduces the physician's transition
// that previously stopped in the fourth 10-second advance.
const session = createBerlinLiveHumModSession({
  caseId: 'berlin-moderate-moderate-aspiration',
  ventilation: {
    mode: 'VC_AC', fio2: 0.60, peep: 8, rr: 20,
    vtL: 0.42, inspiratoryFlowLps: 0.70, inspiratoryPauseSec: 0.20,
  },
  initialRecruitmentState: { normal: 1, recruitable: 0.35, consolidated: 0 },
  dt: 0.002,
  heartRateControlMode: 'hummod2013-baro-chemo',
});
session.initialize();
session.requestVentilationChange({
  mode: 'VC_AC', fio2: 0.30, peep: 3, rr: 4,
  vtL: 0.42, inspiratoryFlowLps: 0.70, inspiratoryPauseSec: 0.20,
});
let firstCns;
let last;
for (let i = 0; i < 10; i++) {
  const snapshot = session.runFor(10);
  const h = snapshot.systemic.hemodynamics;
  assert.equal(snapshot.timeSec, (i + 1) * 10);
  assert.equal(h.heartRateControlMode, 'hummod2013-baro-chemo');
  assert.equal(h.empiricalChronotropicBoostPerMin, 0);
  assert(h.autonomicAuthority.heartRate.includes('2012/2013'));
  assert(Number.isFinite(h.heartRatePerMin));
  assert(Number.isFinite(h.cardiacOutputMlPerMin));
  assert(Number.isFinite(snapshot.systemic.gasExchange.pao2MmHg));
  assert(Math.abs(h.heartRatePerMin -
    h.hummod2013HeartRateState.heartRatePerMin * h.chronotropicReserveMultiplier) < 1e-9);
  firstCns ??= h.hummod2013HeartRateState.chemoreceptorsCns.effect;
  last = h;
}
assert(last.hummod2013HeartRateState.chemoreceptorsCns.effect > firstCns,
  'the actual hypoxic/acidemic input must reach CNS chemoreflex dynamics');
console.log('ok - manual low-PEEP transition advances with source chemoreflex HR and no empirical boost');

for (const method of ['requestInspiratoryHold', 'requestExpiratoryHold',
  'performPassiveMechanicsMeasurement']) {
  const before = session.snapshot().timeSec;
  const snapshot = session[method]();
  assert(snapshot.timeSec > before, 'hold must advance the same patient clock');
  const m = snapshot.pulmonary.measurements;
  assert(Number.isFinite(m.plateauPressureCmH2O));
  if (method !== 'requestInspiratoryHold') {
    assert(Number.isFinite(m.totalPeepCmH2O));
    assert(Math.abs(m.drivingPressureCmH2O -
      (m.plateauPressureCmH2O - m.totalPeepCmH2O)) < 1e-9);
  }
}
console.log('ok - individual and combined holds preserve mechanics-tick timing and measured pressures');
