'use strict';

const {
  LIVE_HUMMOD_REFERENCE_CASE_ID,
  createBerlinLiveHumModSession,
} = require('../src/clinical_twin_live_hummod_session.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log('ok -', name); passed += 1; }
  catch (e) { console.error('FAIL -', name, ':', e.message); failed += 1; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

function makeSession(overrides = {}) {
  return createBerlinLiveHumModSession({
    caseId: LIVE_HUMMOD_REFERENCE_CASE_ID,
    ventilation: {
      mode: 'VC_AC', fio2: 0.60, peep: 8, rr: 20,
      vtL: 0.42, inspiratoryFlowLps: 0.70, inspiratoryPauseSec: 0.20,
    },
    initialRecruitmentState: {
      normal: 1, recruitable: 0.35, consolidated: 0,
    },
    dt: 0.002,
    mechanicalWarmupSec: 3,
    ...overrides,
  });
}

test('live session initializes with finite HumMod-derived gas and circulation outputs', () => {
  const s = makeSession().initialize();
  assert(s.coupling.mode === 'live-reduced-hummod-ards-core');
  assert(s.systemic.status === 'live-coupled-experimental');
  assert(Number.isFinite(s.systemic.gasExchange.pao2MmHg));
  assert(Number.isFinite(s.systemic.gasExchange.paco2MmHg));
  assert(Number.isFinite(s.systemic.hemodynamics.meanArterialPressureMmHg));
  assert(Number.isFinite(s.systemic.hemodynamics.cardiacOutputMlPerMin));
  assert(s.provenance.boundaryStatus.includes('synthetic-engineering'));
});

test('PEEP intervention persists and live systemic state advances rather than replaying a fixed row', () => {
  const session = makeSession();
  const initial = session.initialize();
  const before = session.runFor(5);
  session.setPEEP(14);
  const after = session.runFor(5);
  assert(initial.timeSec < before.timeSec && before.timeSec < after.timeSec);
  assert(after.ventilator.peepCmH2O === 14);
  assert(after.systemic.coupling.ventilatedPerfusionFraction !== undefined);
  assert(Number.isFinite(after.systemic.gasExchange.pao2MmHg));
  assert(Number.isFinite(after.systemic.hemodynamics.meanArterialPressureMmHg));
});

test('PEEP challenge produces dynamic cardiopulmonary and autonomic response', () => {
  const session = makeSession();
  session.initialize();
  const baseline = session.runFor(20);
  const b = baseline.systemic.hemodynamics;
  session.setPEEP(18);
  const early = session.runFor(5);
  const late = session.runFor(20);
  const e = early.systemic.hemodynamics;
  const l = late.systemic.hemodynamics;

  [
    b.heartRatePerMin, b.meanArterialPressureMmHg, b.cardiacOutputMlPerMin,
    b.strokeVolumeMl, b.systemicVascularResistanceMmHgMinPerL,
    b.pulmonaryVascularResistanceMmHgMinPerL, b.sympatheticTone,
    l.heartRatePerMin, l.meanArterialPressureMmHg, l.cardiacOutputMlPerMin,
    l.strokeVolumeMl, l.systemicVascularResistanceMmHgMinPerL,
    l.pulmonaryVascularResistanceMmHgMinPerL, l.sympatheticTone,
  ].forEach(v => assert(Number.isFinite(v), 'challenge outputs must remain finite'));

  assert(late.systemic.thorax.meanAirwayPressureCmH2O >
    baseline.systemic.thorax.meanAirwayPressureCmH2O,
    'higher PEEP should increase mean airway pressure in this fixed challenge');
  assert(Math.abs(l.cardiacOutputMlPerMin - b.cardiacOutputMlPerMin) > 1,
    'cardiac output should not remain static after PEEP challenge');
  assert(Math.abs(l.strokeVolumeMl - b.strokeVolumeMl) > 0.01,
    'stroke volume should not remain static after PEEP challenge');
  assert(Math.abs(l.meanArterialPressureMmHg - b.meanArterialPressureMmHg) > 0.01,
    'MAP should not remain static after PEEP challenge');
  assert(Math.abs(l.sympatheticTone - b.sympatheticTone) > 0.0001,
    'autonomic state should respond to the challenge');
  assert(Math.abs(l.systemicVascularResistanceMmHgMinPerL -
    b.systemicVascularResistanceMmHgMinPerL) > 0.001,
    'SVR should evolve during the challenge');
  assert(Math.abs(l.pulmonaryVascularResistanceMmHgMinPerL -
    b.pulmonaryVascularResistanceMmHgMinPerL) > 0.001,
    'PVR should evolve during the challenge');
  assert(e.cardiacOutputMlPerMin !== l.cardiacOutputMlPerMin,
    'early and late cardiac output should differ as feedback evolves');
});

test('FiO2/VC setting changes are applied at a breath boundary and feed the live core', () => {
  const session = makeSession();
  session.initialize();
  session.requestVentilationChange({
    mode: 'VC_AC', fio2: 0.80, peep: 8, rr: 20,
    vtL: 0.42, inspiratoryFlowLps: 0.70, inspiratoryPauseSec: 0.20,
  });
  const s = session.runFor(5);
  assert(s.ventilator.fio2 === 0.80);
  assert(s.ventilatorChangePending === false);
  assert(Number.isFinite(s.systemic.gasExchange.pao2MmHg));
});

test('prolonged profound hypoxemic hypercapnic failure decompensates instead of remaining hemodynamically normal', () => {
  const session = makeSession();
  session.initialize();
  session.requestVentilationChange({
    mode: 'VC_AC', fio2: 0.20, peep: 8, rr: 4,
    vtL: 0.10, inspiratoryFlowLps: 0.20, inspiratoryPauseSec: 0,
  });
  const s = session.runFor(1200);
  const g = s.systemic.gasExchange;
  const h = s.systemic.hemodynamics;
  const d = s.systemic.decompensation;

  assert(g.pao2MmHg < 30, 'extremis challenge should produce profound hypoxemia');
  assert(g.paco2MmHg > 150, 'extremis challenge should produce severe hypercapnia');
  assert(g.pH < 6.9, 'extremis challenge should produce profound acidemia');
  assert(d && d.oxygenDebtMl > 0, 'extremis challenge should accumulate oxygen debt');
  assert(d.myocardialContractilityMultiplier < 1,
    'oxygen debt should depress myocardial reserve');
  assert(
    d.cardiacArrest === true ||
    h.meanArterialPressureMmHg < 60 ||
    h.cardiacOutputMlPerMin < 3000,
    'after 20 min of profound hypoxemic-hypercapnic failure, patient must show major hemodynamic decompensation or arrest'
  );
});

test('live core rejects PC-AC until its Vent adapter is implemented', () => {
  let threw = false;
  try {
    makeSession({ ventilation: {
      mode: 'PC_AC', fio2: 0.60, peep: 8, rr: 20,
      pinspCmH2O: 12, inspiratoryTimeSec: 0.8, inspiratoryPauseSec: 0,
    }});
  } catch (e) {
    threw = /VC_AC only/.test(e.message);
  }
  assert(threw, 'expected explicit VC_AC-only error');
});

test('live core is restricted to the authored reference case while boundaries are synthetic', () => {
  let threw = false;
  try {
    createBerlinLiveHumModSession({
      caseId: 'berlin-mild-low-pneumonia',
      ventilation: {
        mode: 'VC_AC', fio2: 0.40, peep: 5, rr: 16,
        vtL: 0.45, inspiratoryFlowLps: 0.70, inspiratoryPauseSec: 0.1,
      },
      initialRecruitmentState: { normal: 1, recruitable: 0.2, consolidated: 0 },
    });
  } catch (e) {
    threw = /currently calibrated only/.test(e.message);
  }
  assert(threw, 'expected reference-case restriction');
});

console.log('\nTests: passed=' + passed + ' failed=' + failed);
process.exit(failed === 0 ? 0 : 1);
