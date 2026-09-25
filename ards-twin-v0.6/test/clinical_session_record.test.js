'use strict';

const { createClinicalSessionRecord } = require('../src/clinical_session_record.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log('ok -', name); passed += 1; }
  catch (e) { console.error('FAIL -', name, ':', e.message); failed += 1; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

function snapshot() {
  return {
    sessionSchema: 'berlin-clinical-twin-session/v1',
    timeSec: 12,
    case: { id: 'berlin-moderate-moderate-aspiration', synthetic: true },
    ventilator: { mode: 'VC_AC', peepCmH2O: 8 },
    ventilatorChangePending: false,
    pulmonary: {
      initialization: { source: 'explicit-initial-recruitment-state' },
      measurements: { plateauPressureCmH2O: 22 },
      compartments: [{ id: 'normal', recruitment: 1 }],
      gasExchangeAuthority: 'disabled-in-Vent-for-composed-session',
    },
    systemic: {
      timestampSec: 10,
      source: {
        subjectId: 'berlin-moderate-moderate-aspiration',
        runId: 'trajectory-1',
        modelVersion: '8dab57',
        exporterVersion: 'runner/1',
      },
    },
    coupling: { mode: 'shared-clock-replay' },
    events: [{ t: 2, kind: 'SET_PEEP' }],
    provenance: { pulmonary: 'Vent', systemic: 'HumMod' },
  };
}

test('session record preserves reproducibility-critical metadata', () => {
  const r = createClinicalSessionRecord(snapshot());
  assert(r.schema === 'vent-clinical-session-record/v1');
  assert(r.case.id === 'berlin-moderate-moderate-aspiration');
  assert(r.ventilator.mode === 'VC_AC');
  assert(r.initialization.source === 'explicit-initial-recruitment-state');
  assert(r.systemicReference.trajectoryId === 'trajectory-1');
  assert(r.events.length === 1);
  assert(r.provenance.status === 'simulation-record-not-clinical-validation');
});

test('session record rejects unrelated objects', () => {
  let threw = false;
  try { createClinicalSessionRecord({}); } catch (_) { threw = true; }
  assert(threw);
});

console.log('\nTests: passed=' + passed + ' failed=' + failed);
process.exit(failed === 0 ? 0 : 1);
