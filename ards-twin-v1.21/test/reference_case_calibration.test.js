'use strict';

const {
  REFERENCE_CASE_ID,
  EVIDENCE,
  buildReferenceCaseCalibration,
} = require('../src/reference_case_calibration.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log('ok -', name); passed += 1; }
  catch (e) { console.error('FAIL -', name, ':', e.message); failed += 1; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

test('reference case is the moderate/intermediate aspiration case', () => {
  const c = buildReferenceCaseCalibration();
  assert(c.caseId === REFERENCE_CASE_ID);
  assert(c.clinicalAxis.berlinSeverity === 'moderate');
  assert(c.mechanicalAxis.authoredRecruitabilityLabel === 'moderate');
});

test('reference profile never aliases preset recruitability to clinical R/I', () => {
  const c = buildReferenceCaseCalibration();
  assert(c.mechanicalAxis.clinicalRecruitabilityEquivalent === null);
  assert(c.mechanicalAxis.recruitmentToInflationRatioTarget === null);
  assert(c.mechanicalAxis.status.includes('not-clinical-RI-classification'));
  assert(c.prohibitedShortcuts.some(x => x.includes('R/I ratio')));
});

test('preset airway opening pressure is explicitly not a patient measurement', () => {
  const c = buildReferenceCaseCalibration();
  assert(Number.isFinite(c.airwayOpeningPressure.modelValueCmH2O));
  assert(c.airwayOpeningPressure.status === 'mechanistic-preset-parameter-not-patient-measurement');
});

test('reference profile carries verifiable evidence identifiers', () => {
  assert(EVIDENCE.chards.doi === '10.1186/s13054-020-03112-0');
  assert(EVIDENCE.chenRi.doi === '10.1164/rccm.201902-0334OC');
  assert(EVIDENCE.lungSafe.pmid === '26903337');
  assert(EVIDENCE.guerinAirwayClosure.pmid === '32352339');
});

console.log('\nTests: passed=' + passed + ' failed=' + failed);
process.exit(failed === 0 ? 0 : 1);
