'use strict';

const { createBerlinClinicalTwinSession } = require('../src/clinical_twin_session.js');
const { HUMMOD_EXPORT_SCHEMA } = require('../src/hummod_export_contract.js');
const { HUMMOD_STANDALONE_UPSTREAM } = require('../src/hummod_standalone_manifest.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log('ok -', name); passed += 1; }
  catch (e) { console.error('FAIL -', name, ':', e.message); failed += 1; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

function makeExport() {
  return {
    schema: HUMMOD_EXPORT_SCHEMA,
    trajectoryId: 'fixture-session-systemic-001',
    source: {
      repository: HUMMOD_STANDALONE_UPSTREAM.repository,
      revision: HUMMOD_STANDALONE_UPSTREAM.revision,
      exporterVersion: 'fixture-exporter/1',
    },
    symbols: [
      'PO2Artys.Pressure',
      'CO2Artys.Pressure',
      'BloodPh.ArtysPh',
      'Heart-Rate.Rate',
      'SystemicArtys.Pressure',
      'CardiacOutput.Flow(L/Min)',
    ],
    rows: [
      { timestampSec: 0, values: {
        'PO2Artys.Pressure': 80,
        'CO2Artys.Pressure': 40,
        'BloodPh.ArtysPh': 7.4,
        'Heart-Rate.Rate': 90,
        'SystemicArtys.Pressure': 75,
        'CardiacOutput.Flow(L/Min)': 5,
      } },
      { timestampSec: 2, values: {
        'PO2Artys.Pressure': 79,
        'CO2Artys.Pressure': 40.5,
        'BloodPh.ArtysPh': 7.39,
        'Heart-Rate.Rate': 91,
        'SystemicArtys.Pressure': 74,
        'CardiacOutput.Flow(L/Min)': 5.0,
      } },
      { timestampSec: 5, values: {
        'PO2Artys.Pressure': 78,
        'CO2Artys.Pressure': 41,
        'BloodPh.ArtysPh': 7.38,
        'Heart-Rate.Rate': 92,
        'SystemicArtys.Pressure': 73,
        'CardiacOutput.Flow(L/Min)': 4.9,
      } },
    ],
  };
}

function makeSession() {
  return createBerlinClinicalTwinSession({
    caseId: 'berlin-moderate-moderate-aspiration',
    humModExport: makeExport(),
    ventilation: {
      mode: 'VC_AC',
      fio2: 0.6,
      peep: 8,
      rr: 20,
      vtL: 0.42,
      inspiratoryFlowLps: 0.7,
      inspiratoryPauseSec: 0.2,
    },
    initialRecruitmentState: {
      normal: 1,
      recruitable: 0.35,
      consolidated: 0,
    },
    dt: 0.002,
  });
}

test('session requires explicit ventilation and recruitment state', () => {
  let threwVent = false;
  try {
    createBerlinClinicalTwinSession({
      caseId: 'berlin-moderate-moderate-aspiration',
      humModExport: makeExport(),
      initialRecruitmentState: { normal: 1, recruitable: 0.35, consolidated: 0 },
    });
  } catch (_) { threwVent = true; }
  assert(threwVent, 'missing ventilation should fail');

  let threwRec = false;
  try {
    createBerlinClinicalTwinSession({
      caseId: 'berlin-moderate-moderate-aspiration',
      humModExport: makeExport(),
      ventilation: {
        mode: 'VC_AC', fio2: 0.6, peep: 8, rr: 20,
        vtL: 0.42, inspiratoryFlowLps: 0.7, inspiratoryPauseSec: 0.2,
      },
    });
  } catch (_) { threwRec = true; }
  assert(threwRec, 'missing recruitment state should fail');
});

test('session initializes shared Vent and HumMod state without browser gas model', () => {
  const session = makeSession();
  const snap = session.initialize();
  assert(snap.case.berlinSeverity === 'moderate');
  assert(snap.case.recruitability === 'moderate');
  assert(snap.ventilator.mode === 'VC_AC');
  assert(snap.pulmonary.engine === 'Vent');
  assert(snap.pulmonary.gasExchangeAuthority === 'disabled-in-Vent-for-composed-session');
  assert(snap.systemic.timestampSec === 0);
  assert(snap.systemic.hemodynamics.heartRatePerMin === 90);
});

test('session advances Vent and samples HumMod on the same session clock', () => {
  const session = makeSession();
  session.initialize();
  const snap = session.runFor(2);
  assert(Math.abs(snap.timeSec - 2) < 0.01, 'Vent time should advance to about 2 seconds');
  assert(snap.systemic.timestampSec === 2, 'HumMod replay should sample the 2 second row');
});

test('PEEP changes preserve the session and declare replay coupling limitation', () => {
  const session = makeSession();
  session.initialize();
  const snap = session.setPEEP(10);
  assert(snap.ventilator.peepCmH2O === 10);
  const event = snap.events[snap.events.length - 1];
  assert(event.kind === 'SET_PEEP');
  assert(event.pulmonaryResponse === 'modeled-by-Vent');
  assert(event.systemicResponse === 'not-modeled-by-fixed-HumMod-replay');
});

test('session refuses to extrapolate HumMod replay past source trajectory', () => {
  const session = makeSession();
  session.initialize();
  let threw = false;
  try { session.runFor(6); } catch (_) { threw = true; }
  assert(threw, 'fixed replay must not extrapolate');
});

console.log('\nTests: passed=' + passed + ' failed=' + failed);
process.exit(failed === 0 ? 0 : 1);
