'use strict';

const {
  RECRUITMENT_HISTORY_SCHEMA,
  validateRecruitmentHistory,
  deriveRecruitmentFromHistory,
} = require('../src/recruitment_history.js');
const { PRESETS } = require('../src/presets.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log('ok -', name); passed += 1; }
  catch (e) { console.error('FAIL -', name, ':', e.message); failed += 1; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

function makeHistory() {
  return {
    schema: RECRUITMENT_HISTORY_SCHEMA,
    startingRecruitableFraction: 0.2,
    startingStateSource: 'test fixture explicit prior state',
    segments: [
      { pressureCmH2O: 35, durationSec: 10, note: 'sustained high-pressure segment' },
      { pressureCmH2O: 8, durationSec: 20, note: 'lower-pressure segment' },
    ],
  };
}

test('history requires explicit prior recruitment state and pressure segments', () => {
  const h = makeHistory();
  assert(validateRecruitmentHistory(h) === h);

  let threw = false;
  const bad = { ...h, startingStateSource: '' };
  try { validateRecruitmentHistory(bad); } catch (_) { threw = true; }
  assert(threw);
});

test('history derives a bounded recruitment state deterministically', () => {
  const params = PRESETS.phenotype_moderate_recruitability();
  const recruitable = params.compartments.find(c => c.id === 'recruitable');
  const a = deriveRecruitmentFromHistory({
    history: makeHistory(),
    recruitableCompartmentParams: recruitable,
    airwayOpeningPressureCmH2O: params.airwayOpeningPressure,
    integrationStepSec: 0.02,
  });
  const b = deriveRecruitmentFromHistory({
    history: makeHistory(),
    recruitableCompartmentParams: recruitable,
    airwayOpeningPressureCmH2O: params.airwayOpeningPressure,
    integrationStepSec: 0.02,
  });

  assert(a.initialRecruitmentState.normal === 1);
  assert(a.initialRecruitmentState.consolidated === 0);
  assert(a.initialRecruitmentState.recruitable >= 0);
  assert(a.initialRecruitmentState.recruitable <= 1);
  assert(a.initialRecruitmentState.recruitable === b.initialRecruitmentState.recruitable);
  assert(a.segmentResults.length === 2);
  assert(a.provenance.status === 'derived-from-explicit-initialization-history');
});

test('high-pressure history changes recruitment relative to the declared start', () => {
  const params = PRESETS.phenotype_high_recruitability();
  const recruitable = params.compartments.find(c => c.id === 'recruitable');
  const result = deriveRecruitmentFromHistory({
    history: {
      schema: RECRUITMENT_HISTORY_SCHEMA,
      startingRecruitableFraction: 0.1,
      startingStateSource: 'test fixture explicit prior state',
      segments: [{ pressureCmH2O: 40, durationSec: 20 }],
    },
    recruitableCompartmentParams: recruitable,
    airwayOpeningPressureCmH2O: params.airwayOpeningPressure,
  });
  assert(result.initialRecruitmentState.recruitable > 0.1);
});

test('history does not infer a starting fraction', () => {
  const params = PRESETS.phenotype_low_recruitability();
  const recruitable = params.compartments.find(c => c.id === 'recruitable');
  let threw = false;
  try {
    deriveRecruitmentFromHistory({
      history: {
        schema: RECRUITMENT_HISTORY_SCHEMA,
        startingStateSource: 'missing fraction by design',
        segments: [{ pressureCmH2O: 30, durationSec: 10 }],
      },
      recruitableCompartmentParams: recruitable,
      airwayOpeningPressureCmH2O: params.airwayOpeningPressure,
    });
  } catch (_) { threw = true; }
  assert(threw);
});

console.log('\nTests: passed=' + passed + ' failed=' + failed);
process.exit(failed === 0 ? 0 : 1);
