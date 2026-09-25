'use strict';

const { createHumModStandaloneExportMapper } = require('../src/hummod_standalone_binding.js');
const { HUMMOD_STANDALONE_UPSTREAM } = require('../src/hummod_standalone_manifest.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log('ok -', name); passed += 1; }
  catch (e) { console.error('FAIL -', name, ':', e.message); failed += 1; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

function makeMapper(extra = {}) {
  return createHumModStandaloneExportMapper({
    hummodRevision: HUMMOD_STANDALONE_UPSTREAM.revision,
    exporterVersion: 'fixture-exporter-v1',
    timestampPath: 'export.timestampSec',
    exportPaths: {
      'PO2Artys.Pressure': 'model.arterial.po2',
      'CO2Artys.Pressure': 'model.arterial.pco2',
      'BloodPh.ArtysPh': 'model.arterial.ph',
      'Heart-Rate.Rate': 'model.cardio.hr',
      'SystemicArtys.Pressure': 'model.cardio.map',
      'CardiacOutput.Flow(L/Min)': 'model.cardio.co',
    },
    requiredTargets: ['timestampSec', 'gasExchange.pao2MmHg'],
    ...extra,
  });
}

test('maps only source-verified HumMod symbols through declared export paths', () => {
  const mapper = makeMapper();
  const snapshot = mapper({
    export: { timestampSec: 12 },
    model: {
      arterial: { po2: 83, pco2: 41, ph: 7.34 },
      cardio: { hr: 101, map: 74, co: 5.2 },
    },
  });
  assert(snapshot.timestampSec === 12);
  assert(snapshot.gasExchange.pao2MmHg === 83);
  assert(snapshot.gasExchange.paco2MmHg === 41);
  assert(snapshot.gasExchange.ph === 7.34);
  assert(snapshot.hemodynamics.heartRatePerMin === 101);
  assert(snapshot.hemodynamics.meanArterialPressureMmHg === 74);
  assert(snapshot.hemodynamics.cardiacOutputLPerMin === 5.2);
  assert(snapshot.source.modelVersion.includes(HUMMOD_STANDALONE_UPSTREAM.revision));
  assert(snapshot.source.modelVersion.includes('fixture-exporter-v1'));
});

test('rejects a different HumMod revision until the manifest is reverified', () => {
  let threw = false;
  try { makeMapper({ hummodRevision: '0000000000000000000000000000000000000000' }); }
  catch (_) { threw = true; }
  assert(threw, 'revision mismatch must fail');
});

test('rejects a pending saturation symbol rather than silently converting units', () => {
  let threw = false;
  try {
    makeMapper({
      exportPaths: {
        'PO2Artys.Pressure': 'model.po2',
        'PO2Artys.Sat(%)': 'model.sat',
      },
    });
  } catch (_) { threw = true; }
  assert(threw, 'percent saturation direct binding must fail until transform is explicit');
});

test('rejects right atrial pressure as direct CVP until semantic mapping is approved', () => {
  let threw = false;
  try {
    makeMapper({ exportPaths: { 'RightAtrium.Pressure': 'model.rap' } });
  } catch (_) { threw = true; }
  assert(threw, 'RAP must not silently become normalized CVP');
});

test('rejects unknown source symbols', () => {
  let threw = false;
  try { makeMapper({ exportPaths: { 'SomePlausible.Pressure': 'model.x' } }); }
  catch (_) { threw = true; }
  assert(threw, 'unverified source symbol must fail');
});

console.log(`\nTests: passed=${passed} failed=${failed}`);
process.exit(failed === 0 ? 0 : 1);
