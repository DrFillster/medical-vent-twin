'use strict';

const {
  TEMPTOOLS,
  BRONCHI_VAPOR_PRESSURE_MMHG,
  saturationVaporPressureMmHg,
  bronchiGasFractions,
  btpsToStpdVolumeMl,
  humModLegacyDeadSpaceMl,
  breathingFromVent,
} = require('../src/hummod_ards_core_breathing.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log('ok -', name); passed += 1; }
  catch (e) { console.error('FAIL -', name, ':', e.message); failed += 1; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function near(a,b,tol=1e-10){ assert(Math.abs(a-b)<=tol, a+' != '+b); }

test('TempTools vapor pressure follows HumMod source equation', () => {
  const t = 37;
  const expected = Math.exp(TEMPTOOLS.A - (TEMPTOOLS.B / (t + TEMPTOOLS.C)));
  near(saturationVaporPressureMmHg(t), expected);
});

test('Bronchi humidification follows HumMod dilution equation', () => {
  const out = bronchiGasFractions({
    inspiredPressureMmHg: 760,
    inspiredO2Fraction: 0.21,
    inspiredCo2Fraction: 0,
  });
  const dilution = 1 - (BRONCHI_VAPOR_PRESSURE_MMHG / 760);
  near(out.dilution, dilution);
  near(out.o2Fraction, dilution * 0.21);
  near(out.po2MmHg, dilution * 0.21 * 760);
});

test('BTPS to STPD follows HumMod source equation', () => {
  const out = btpsToStpdVolumeMl({
    volumeBtpsMl: 500,
    inspiredPressureMmHg: 760,
    bodyTempC: 37,
  });
  const vapor = saturationVaporPressureMmHg(37);
  const expected = 500 * ((760 - vapor) / 760) * (273.2 / (37 + 273.15));
  near(out.volumeStpdMl, expected);
});

test('HumMod legacy dead space follows source line', () => {
  near(humModLegacyDeadSpaceMl(500), 160);
});

test('breathing adapter uses explicit dead space when supplied', () => {
  const out = breathingFromVent({
    respiratoryRatePerMin: 20,
    tidalVolumeBtpsMl: 500,
    inspiredPressureMmHg: 760,
    bodyTempC: 37,
    deadSpaceBtpsMl: 150,
  });
  assert(out.deadSpaceSource === 'explicit-boundary');
  near(out.alveolarVolumeBtpsMl, 350);
  near(out.alveolarVentilationBtpsMlPerMin, 7000);
  assert(out.alveolarVentilationStpdMlPerMin > 0);
});

test('breathing adapter requires explicit dead space unless legacy mode chosen', () => {
  let threw = false;
  try {
    breathingFromVent({
      respiratoryRatePerMin: 20,
      tidalVolumeBtpsMl: 500,
      inspiredPressureMmHg: 760,
      bodyTempC: 37,
    });
  } catch (_) { threw = true; }
  assert(threw);
});

console.log('\nTests: passed=' + passed + ' failed=' + failed);
process.exit(failed === 0 ? 0 : 1);
