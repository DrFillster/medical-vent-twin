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
    mechanicalWarmupSec: 2,
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
