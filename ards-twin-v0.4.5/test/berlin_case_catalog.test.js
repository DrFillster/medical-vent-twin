'use strict';

const {
  BERLIN_CASE_CATALOG,
  getBerlinCase,
} = require('../src/berlin_case_catalog.js');

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

test('catalog contains nine unique synthetic cases', () => {
  assert(BERLIN_CASE_CATALOG.length === 9, `expected 9 cases, got ${BERLIN_CASE_CATALOG.length}`);
  assert(new Set(BERLIN_CASE_CATALOG.map(c => c.id)).size === 9, 'case IDs must be unique');
  assert(BERLIN_CASE_CATALOG.every(c => c.synthetic === true), 'all cases must be explicitly synthetic');
});

test('catalog spans complete Berlin-by-recruitability matrix', () => {
  ['mild', 'moderate', 'severe'].forEach(severity => {
    ['low', 'moderate', 'high'].forEach(recruitability => {
      assert(BERLIN_CASE_CATALOG.some(c =>
        c.clinical.berlinSeverity === severity && c.phenotype.recruitability === recruitability),
      `missing ${severity}/${recruitability}`);
    });
  });
});

test('Berlin calibration stays constant when recruitability changes within severity', () => {
  ['mild', 'moderate', 'severe'].forEach(severity => {
    const cases = BERLIN_CASE_CATALOG.filter(c => c.clinical.berlinSeverity === severity);
    const pf = new Set(cases.map(c => c.calibrationTargets.oxygenation.pfRatio.median));
    const peep = new Set(cases.map(c => c.startingVentilation.peepCmH2O));
    assert(pf.size === 1, `${severity} P/F target changed with recruitability`);
    assert(peep.size === 1, `${severity} PEEP cohort target changed with recruitability`);
    assert(new Set(cases.map(c => c.phenotype.mechanicsPresetId)).size === 3,
      `${severity} mechanics presets should remain distinct`);
  });
});

test('case assumptions and evidence-calibrated targets are distinguished', () => {
  BERLIN_CASE_CATALOG.forEach(c => {
    assert(c.clinical.authoringStatus === 'synthetic-scenario-assumption');
    assert(c.calibrationTargets.status === 'published-cohort-envelope-not-individual-patient-truth');
    assert(Array.isArray(c.provenance.cohortSources) && c.provenance.cohortSources.length >= 2,
      `${c.id} missing cohort provenance`);
  });
});

test('patient-specific calculated ventilation is not fabricated', () => {
  BERLIN_CASE_CATALOG.forEach(c => {
    assert(c.startingVentilation.tidalVolumeMl === null, `${c.id} should not invent VT mL`);
    assert(c.startingVentilation.fio2Fraction === null, `${c.id} should not invent FiO2`);
    assert(c.startingVentilation.respiratoryRatePerMin === null, `${c.id} should not invent RR`);
  });
});

test('HumMod linkage is explicit and initially unpopulated', () => {
  BERLIN_CASE_CATALOG.forEach(c => {
    assert(c.systemicTwin.provider === 'HumMod');
    assert(c.systemicTwin.status === 'mapping-pending');
    assert(c.systemicTwin.trajectoryId === null);
    assert(c.systemicTwin.modelVersion === null);
  });
});

test('case lookup is deterministic and rejects unknown IDs', () => {
  const first = BERLIN_CASE_CATALOG[0];
  assert(getBerlinCase(first.id) === first, 'lookup should return catalog object');
  let threw = false;
  try { getBerlinCase('not-a-real-case'); } catch (_) { threw = true; }
  assert(threw, 'unknown case should throw');
});

console.log(`\nTests: passed=${passed} failed=${failed}`);
process.exit(failed === 0 ? 0 : 1);
