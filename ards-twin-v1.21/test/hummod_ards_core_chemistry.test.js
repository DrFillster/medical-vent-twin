'use strict';

const {
  HGB,
  phFromPco2Sid,
  pco2FromHco3Sid,
  hemoglobinProperties,
  saturationFractionFromPo2,
} = require('../src/hummod_ards_core_chemistry.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log('ok -', name); passed += 1; }
  catch (e) { console.error('FAIL -', name, ':', e.message); failed += 1; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function near(a,b,tol=1e-10){ assert(Math.abs(a-b)<=tol, a+' != '+b); }

test('HumMod baseline hemoglobin properties recover source P50', () => {
  const p = hemoglobinProperties({
    tempC: 37,
    pH: 7.40,
    pco2MmHg: 40,
    carboxyPercent: 0,
  });
  near(p.p50MmHg, 26.6, 1e-12);
  near(p.effects.temperature, 1, 1e-12);
  near(p.effects.pH, 1, 1e-12);
  near(p.effects.pco2, 1, 1e-12);
  near(p.effects.carbonMonoxide, 1, 1e-12);
});

test('HumMod pH equation follows source algebra', () => {
  const sid = 40 * Math.pow(10, 7.40 - 7.42);
  const out = phFromPco2Sid({ pco2MmHg: 40, sid });
  near(out.pH, 7.40, 1e-12);
});

test('HumMod BaseToGas equation follows source constants', () => {
  const hco3 = 0.024;
  const sid = 0.040;
  const expected = Math.max((-645.8 * sid) + (2777.8 * hco3), 0.0001);
  const out = pco2FromHco3Sid({ hco3MolPerL: hco3, sidMolPerL: sid });
  near(out.pco2MmHg, expected, 1e-12);
});

test('oxygen saturation responds to HumMod P50 shifts', () => {
  const baseline = hemoglobinProperties({
    tempC: 37, pH: 7.40, pco2MmHg: 40, carboxyPercent: 0,
  });
  const acid = hemoglobinProperties({
    tempC: 37, pH: 7.20, pco2MmHg: 40, carboxyPercent: 0,
  });
  assert(acid.p50MmHg > baseline.p50MmHg, 'lower pH should increase P50 in HumMod source equation');
  const satBase = saturationFractionFromPo2({
    po2MmHg: 60,
    p50MmHg: baseline.p50MmHg,
    scaleForSat: baseline.scaleForSat,
  });
  const satAcid = saturationFractionFromPo2({
    po2MmHg: 60,
    p50MmHg: acid.p50MmHg,
    scaleForSat: acid.scaleForSat,
  });
  assert(satAcid < satBase, 'higher P50 should lower saturation at fixed PO2');
});

test('saturation is bounded', () => {
  const p = hemoglobinProperties({
    tempC: 37, pH: 7.4, pco2MmHg: 40, carboxyPercent: 0,
  });
  assert(saturationFractionFromPo2({
    po2MmHg: 0,
    p50MmHg: p.p50MmHg,
    scaleForSat: p.scaleForSat,
  }) === 0);
  assert(saturationFractionFromPo2({
    po2MmHg: HGB.po2SaturatedMmHg,
    p50MmHg: p.p50MmHg,
    scaleForSat: p.scaleForSat,
  }) === 1);
});

console.log('\nTests: passed=' + passed + ' failed=' + failed);
process.exit(failed === 0 ? 0 : 1);
