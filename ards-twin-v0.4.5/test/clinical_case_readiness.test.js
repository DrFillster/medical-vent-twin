'use strict';

const {
  assessBerlinCaseReadiness,
  listBerlinCaseReadiness,
} = require('../src/clinical_case_readiness.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log('ok -', name); passed += 1; }
  catch (e) { console.error('FAIL -', name, ':', e.message); failed += 1; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

test('readiness exposes all nine authored Berlin cases', () => {
  const rows = listBerlinCaseReadiness();
  assert(rows.length === 9, 'expected nine case readiness records');
});

test('moderate aspiration case preserves cohort-calibrated fields without fabricating missing inputs', () => {
  const r = assessBerlinCaseReadiness('berlin-moderate-moderate-aspiration');
  assert(r.fields.peepCmH2O.status === 'cohort-calibrated');
  assert(r.fields.tidalVolumeMlPerKgPbw.status === 'cohort-calibrated');
  assert(r.fields.fio2Fraction.status === 'required-explicit-input');
  assert(r.fields.respiratoryRatePerMin.status === 'required-explicit-input');
  assert(r.fields.tidalVolumeMl.status === 'required-explicit-input');
  assert(r.fields.initialRecruitmentState.status === 'required-explicit-input');
  assert(r.fields.humModTrajectory.status === 'required-external-data');
});

test('authored catalog is not misrepresented as immediately executable', () => {
  const r = assessBerlinCaseReadiness('berlin-severe-high-diffuse-inflammatory');
  assert(r.executable === false);
  assert(r.status === 'authored-case-not-yet-executable');
  assert(r.blockers.includes('humModTrajectory'));
  assert(r.note.includes('not clinical validation'));
});

test('unknown cases fail explicitly', () => {
  let threw = false;
  try { assessBerlinCaseReadiness('not-a-case'); } catch (_) { threw = true; }
  assert(threw);
});

console.log('\nTests: passed=' + passed + ' failed=' + failed);
process.exit(failed === 0 ? 0 : 1);
