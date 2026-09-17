'use strict';

const {
  HUMMOD_RAW_SERIES_SCHEMA,
  validateHumModRawSeries,
  convertHumModRawSeries,
} = require('../src/hummod_raw_series_adapter.js');
const {
  HUMMOD_STANDALONE_UPSTREAM,
  listVerifiedDirectMappings,
} = require('../src/hummod_standalone_manifest.js');
const {
  HUMMOD_SOURCE_CLOCK,
} = require('../src/hummod_runner_contract.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log('ok -', name); passed += 1; }
  catch (e) { console.error('FAIL -', name, ':', e.message); failed += 1; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

function rawFixture() {
  const symbols = listVerifiedDirectMappings().map(m => m.symbol);
  const values0 = {
    'PO2Artys.Pressure': 80,
    'CO2Artys.Pressure': 40,
    'BloodPh.ArtysPh': 7.4,
    'Heart-Rate.Rate': 90,
    'SystemicArtys.Pressure': 75,
    'CardiacOutput.Flow(L/Min)': 5,
  };
  const values1 = {
    'PO2Artys.Pressure': 79,
    'CO2Artys.Pressure': 40.5,
    'BloodPh.ArtysPh': 7.39,
    'Heart-Rate.Rate': 91,
    'SystemicArtys.Pressure': 74,
    'CardiacOutput.Flow(L/Min)': 5,
  };
  return {
    schema: HUMMOD_RAW_SERIES_SCHEMA,
    trajectoryId: 'raw-fixture-001',
    source: {
      repository: HUMMOD_STANDALONE_UPSTREAM.repository,
      revision: HUMMOD_STANDALONE_UPSTREAM.revision,
      exporterVersion: 'raw-fixture/1',
    },
    clock: {
      symbol: HUMMOD_SOURCE_CLOCK.symbol,
      unit: HUMMOD_SOURCE_CLOCK.unit,
    },
    symbols,
    rows: [
      { [HUMMOD_SOURCE_CLOCK.symbol]: 2, ...values0 },
      { [HUMMOD_SOURCE_CLOCK.symbol]: 2.5, ...values1 },
    ],
  };
}

test('raw HumMod series validates pinned source, clock and exact symbols', () => {
  const raw = rawFixture();
  assert(validateHumModRawSeries(raw) === raw);
});

test('raw System.X minutes convert to canonical seconds from first sample', () => {
  const canonical = convertHumModRawSeries(rawFixture());
  assert(canonical.rows[0].timestampSec === 0);
  assert(canonical.rows[1].timestampSec === 30);
  assert(canonical.rows[0].sourceClockValue === 2);
  assert(canonical.rows[1].sourceClockValue === 2.5);
  assert(canonical.sourceClock.rawStart === 2);
  assert(canonical.sourceClock.unit === 'minute');
});

test('conversion preserves literal HumMod source-symbol values', () => {
  const raw = rawFixture();
  const canonical = convertHumModRawSeries(raw);
  for (const symbol of raw.symbols) {
    assert(canonical.rows[0].values[symbol] === raw.rows[0][symbol], symbol + ' mismatch');
  }
});

test('raw adapter rejects undeclared and unverified symbols', () => {
  const raw = rawFixture();
  raw.rows[0]['Unexpected.Symbol'] = 1;
  let threwExtra = false;
  try { validateHumModRawSeries(raw); } catch (_) { threwExtra = true; }
  assert(threwExtra);

  const raw2 = rawFixture();
  raw2.symbols = raw2.symbols.concat(['RightAtrium.Pressure']);
  raw2.rows.forEach(row => { row['RightAtrium.Pressure'] = 5; });
  let threwPending = false;
  try { validateHumModRawSeries(raw2); } catch (_) { threwPending = true; }
  assert(threwPending);
});

test('raw adapter rejects non-monotonic System.X', () => {
  const raw = rawFixture();
  raw.rows[1][HUMMOD_SOURCE_CLOCK.symbol] = 2;
  let threw = false;
  try { validateHumModRawSeries(raw); } catch (_) { threw = true; }
  assert(threw);
});

console.log('\nTests: passed=' + passed + ' failed=' + failed);
process.exit(failed === 0 ? 0 : 1);
