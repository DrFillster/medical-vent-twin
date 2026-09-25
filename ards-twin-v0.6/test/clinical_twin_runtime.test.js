'use strict';

const { createBerlinHumModReplayRuntime } = require('../src/clinical_twin_runtime.js');
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
    trajectoryId: 'fixture-moderate-systemic-001',
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
      { timestampSec: 60, values: {
        'PO2Artys.Pressure': 76,
        'CO2Artys.Pressure': 42,
        'BloodPh.ArtysPh': 7.37,
        'Heart-Rate.Rate': 96,
        'SystemicArtys.Pressure': 70,
        'CardiacOutput.Flow(L/Min)': 4.8,
      } },
    ],
  };
}

test('runtime binds named Berlin case to HumMod replay provenance', () => {
  const runtime = createBerlinHumModReplayRuntime({
    caseId: 'berlin-moderate-moderate-aspiration',
    humModExport: makeExport(),
  });
  assert(runtime.clinicalCase.clinical.berlinSeverity === 'moderate');
  assert(runtime.clinicalCase.phenotype.recruitability === 'moderate');
  assert(runtime.systemicSource.provider === 'HumMod-replay');
  assert(runtime.systemicSource.revision === HUMMOD_STANDALONE_UPSTREAM.revision);
});

test('runtime initializes and samples deterministic systemic state', () => {
  const runtime = createBerlinHumModReplayRuntime({
    caseId: 'berlin-moderate-moderate-aspiration',
    humModExport: makeExport(),
  });
  const initial = runtime.initialize();
  assert(initial.systemic.timestampSec === 0);
  assert(initial.systemic.source.subjectId === 'berlin-moderate-moderate-aspiration');
  assert(initial.systemic.hemodynamics.heartRatePerMin === 90);
  const later = runtime.sample(60);
  assert(later.systemic.timestampSec === 60);
  assert(later.systemic.hemodynamics.heartRatePerMin === 96);
});

test('runtime rejects systemic sampling before initialization', () => {
  const runtime = createBerlinHumModReplayRuntime({
    caseId: 'berlin-moderate-moderate-aspiration',
    humModExport: makeExport(),
  });
  let threw = false;
  try { runtime.sample(10); } catch (_) { threw = true; }
  assert(threw);
});

test('runtime refuses to fake HumMod response to arbitrary Vent intervention', () => {
  const runtime = createBerlinHumModReplayRuntime({
    caseId: 'berlin-moderate-moderate-aspiration',
    humModExport: makeExport(),
  });
  let threw = false;
  try { runtime.applyVentIntervention({ kind: 'SET_PEEP', to: 12 }); } catch (_) { threw = true; }
  assert(threw);
});

console.log('\nTests: passed=' + passed + ' failed=' + failed);
process.exit(failed === 0 ? 0 : 1);
