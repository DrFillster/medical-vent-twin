'use strict';

const {
  HUMMOD_EXPORT_SCHEMA,
  validateHumModTrajectoryExport,
  normalizeHumModTrajectoryExport,
  createReplayProviderFromHumModExport,
} = require('../src/hummod_export_contract.js');
const { HUMMOD_STANDALONE_UPSTREAM } = require('../src/hummod_standalone_manifest.js');
const { validateTwinProvider } = require('../src/digital_twin_contract.js');

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

function makeExport() {
  return {
    schema: HUMMOD_EXPORT_SCHEMA,
    trajectoryId: 'fixture-moderate-ards-systemic-001',
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
      {
        timestampSec: 0,
        values: {
          'PO2Artys.Pressure': 80,
          'CO2Artys.Pressure': 40,
          'BloodPh.ArtysPh': 7.4,
          'Heart-Rate.Rate': 90,
          'SystemicArtys.Pressure': 75,
          'CardiacOutput.Flow(L/Min)': 5,
        },
      },
      {
        timestampSec: 30,
        values: {
          'PO2Artys.Pressure': 78,
          'CO2Artys.Pressure': 41,
          'BloodPh.ArtysPh': 7.39,
          'Heart-Rate.Rate': 92,
          'SystemicArtys.Pressure': 73,
          'CardiacOutput.Flow(L/Min)': 5.1,
        },
      },
    ],
  };
}

test('canonical export validates against pinned HumMod revision and symbols', () => {
  const source = makeExport();
  assert(validateHumModTrajectoryExport(source) === source);
});

test('normalization preserves exact mapped systemic values and model provenance', () => {
  const snapshots = normalizeHumModTrajectoryExport(makeExport(), { subjectId: 'case-1' });
  assert(snapshots.length === 2);
  assert(snapshots[0].timestampSec === 0);
  assert(snapshots[0].gasExchange.pao2MmHg === 80);
  assert(snapshots[0].gasExchange.paco2MmHg === 40);
  assert(snapshots[0].gasExchange.ph === 7.4);
  assert(snapshots[0].hemodynamics.heartRatePerMin === 90);
  assert(snapshots[0].hemodynamics.meanArterialPressureMmHg === 75);
  assert(snapshots[0].hemodynamics.cardiacOutputLPerMin === 5);
  assert(snapshots[0].source.subjectId === 'case-1');
  assert(snapshots[0].source.runId === 'fixture-moderate-ards-systemic-001');
  assert(snapshots[0].source.modelVersion.includes(HUMMOD_STANDALONE_UPSTREAM.revision));
});

test('canonical export becomes a deterministic replay provider', () => {
  const provider = createReplayProviderFromHumModExport(makeExport());
  validateTwinProvider(provider);
  const initial = provider.initialize();
  assert(initial.timestampSec === 0);
  assert(provider.sample(29).timestampSec === 0);
  assert(provider.sample(30).timestampSec === 30);
  assert(provider.trajectoryId === 'fixture-moderate-ards-systemic-001');
});

test('trajectory timestamps must be strictly increasing', () => {
  const source = makeExport();
  source.rows[1].timestampSec = 0;
  let threw = false;
  try { validateHumModTrajectoryExport(source); } catch (_) { threw = true; }
  assert(threw, 'duplicate/non-increasing timestamps must be rejected');
});

test('undeclared or unverified symbols are rejected', () => {
  const source = makeExport();
  source.rows[0].values['RightAtrium.Pressure'] = 5;
  let threwUndeclared = false;
  try { validateHumModTrajectoryExport(source); } catch (_) { threwUndeclared = true; }
  assert(threwUndeclared, 'undeclared symbol should fail');

  const source2 = makeExport();
  source2.symbols.push('RightAtrium.Pressure');
  source2.rows.forEach(row => { row.values['RightAtrium.Pressure'] = 5; });
  let threwPending = false;
  try { validateHumModTrajectoryExport(source2); } catch (_) { threwPending = true; }
  assert(threwPending, 'semantically pending HumMod symbol should fail direct export');
});

test('declared symbols must exist with finite values in every row', () => {
  const source = makeExport();
  delete source.rows[1].values['SystemicArtys.Pressure'];
  let threwMissing = false;
  try { validateHumModTrajectoryExport(source); } catch (_) { threwMissing = true; }
  assert(threwMissing, 'missing declared symbol should fail');

  const source2 = makeExport();
  source2.rows[1].values['SystemicArtys.Pressure'] = NaN;
  let threwNan = false;
  try { validateHumModTrajectoryExport(source2); } catch (_) { threwNan = true; }
  assert(threwNan, 'non-finite symbol value should fail');
});

console.log(`\nTests: passed=${passed} failed=${failed}`);
process.exit(failed === 0 ? 0 : 1);
