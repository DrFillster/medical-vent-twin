'use strict';

const {
  BERLIN_COHORT_ENVELOPES,
  classifyBerlinOxygenation,
  makeBerlinVirtualPatient,
  listBerlinVirtualPatientMatrix,
} = require('../src/clinical_scenarios.js');

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

test('Berlin oxygenation boundaries are classified directly', () => {
  assert(classifyBerlinOxygenation({ pfRatio: 300, peepCmH2O: 5 }) === 'mild');
  assert(classifyBerlinOxygenation({ pfRatio: 200, peepCmH2O: 5 }) === 'moderate');
  assert(classifyBerlinOxygenation({ pfRatio: 100, peepCmH2O: 5 }) === 'severe');
  assert(classifyBerlinOxygenation({ pfRatio: 301, peepCmH2O: 5 }) === null);
  assert(classifyBerlinOxygenation({ pfRatio: 80, peepCmH2O: 4.9 }) === null);
});

test('cohort envelopes retain observed CHARDS medians', () => {
  assert(BERLIN_COHORT_ENVELOPES.mild.observed.pfRatio.median === 227);
  assert(BERLIN_COHORT_ENVELOPES.moderate.observed.pfRatio.median === 142);
  assert(BERLIN_COHORT_ENVELOPES.severe.observed.pfRatio.median === 78);
  assert(BERLIN_COHORT_ENVELOPES.mild.observed.peep.median === 7);
  assert(BERLIN_COHORT_ENVELOPES.moderate.observed.peep.median === 8);
  assert(BERLIN_COHORT_ENVELOPES.severe.observed.peep.median === 10);
});

test('Berlin severity and recruitability are independent axes', () => {
  const low = makeBerlinVirtualPatient({ severity: 'severe', recruitability: 'low' });
  const high = makeBerlinVirtualPatient({ severity: 'severe', recruitability: 'high' });
  assert(low.clinical.severity === high.clinical.severity);
  assert(low.clinical.cohortEnvelope.observed.pfRatio.median === 78);
  assert(high.clinical.cohortEnvelope.observed.pfRatio.median === 78);
  assert(low.mechanics.presetId !== high.mechanics.presetId);
});

test('virtual patient never guesses initial recruitability from Berlin grade', () => {
  const patient = makeBerlinVirtualPatient({ severity: 'moderate', recruitability: 'moderate' });
  assert(patient.initialization.initialRecruitmentState === null);
  assert(patient.initialization.requiresExplicitRecruitmentHistory === true);
  assert(patient.gasExchange.useForClinicalScoring === false);
});

test('matrix exposes all nine Berlin-by-recruitability combinations', () => {
  const matrix = listBerlinVirtualPatientMatrix();
  assert(matrix.length === 9, `expected 9 cases, got ${matrix.length}`);
  const ids = new Set(matrix.map(p => p.id));
  assert(ids.size === 9, 'case ids should be unique');
  ['mild', 'moderate', 'severe'].forEach(severity => {
    ['low', 'moderate', 'high'].forEach(recruitability => {
      assert(matrix.some(p => p.clinical.severity === severity &&
        p.mechanics.recruitability === recruitability),
      `missing ${severity}/${recruitability}`);
    });
  });
});

test('invalid severity and recruitability fail explicitly', () => {
  let throws = 0;
  try { makeBerlinVirtualPatient({ severity: 'extreme', recruitability: 'low' }); } catch (_) { throws++; }
  try { makeBerlinVirtualPatient({ severity: 'mild', recruitability: 'unknown' }); } catch (_) { throws++; }
  try { classifyBerlinOxygenation({ pfRatio: NaN, peepCmH2O: 5 }); } catch (_) { throws++; }
  assert(throws === 3, `expected 3 throws, got ${throws}`);
});

console.log(`\nTests: passed=${passed} failed=${failed}`);
process.exit(failed === 0 ? 0 : 1);
