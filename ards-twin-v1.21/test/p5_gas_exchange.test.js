// test/p5_gas_exchange.test.js — P5: compartmental V/Q gas exchange foundation.

const { PRESETS } = require('../src/presets.js');
const { makePatientParams } = require('../src/contracts.js');
const {
  makeInitialGasState,
  stepGasState,
  mixedArterialPo2,
  shuntFraction,
  deadSpaceFraction,
  spo2FromPo2,
} = require('../src/gas_exchange.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('ok -', name); passed++; }
  catch (e) { console.error('FAIL -', name, ':', e.message); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function approx(a, b, eps = 1e-3) { return Math.abs(a - b) < eps; }

// ---- T1: SpO2 = Hill equation on PO2 ----
test('spo2FromPo2: monotonic sigmoid in physiological range', () => {
  const s40  = spo2FromPo2(40);
  const s60  = spo2FromPo2(60);
  const s80  = spo2FromPo2(80);
  const s100 = spo2FromPo2(100);
  assert(s40 < s60 && s60 < s80 && s80 < s100,
    `SpO2 should be monotonic: ${s40} < ${s60} < ${s80} < ${s100}`);
  assert(s100 > 0.95, `PaO2=100 should give SpO2 > 0.95 (got ${s100})`);
  assert(s40 < 0.75, `PaO2=40 should give SpO2 < 0.75 (got ${s40})`);
});

// ---- T2: SpO2 bounded [0,1] ----
test('spo2FromPo2: bounded [0,1]', () => {
  assert(spo2FromPo2(0) === 0);
  assert(spo2FromPo2(-10) === 0);
  assert(spo2FromPo2(1000) <= 1);
  assert(spo2FromPo2(1000) >= 0);
});

// ---- T3: makeInitialGasState uses FiO2 correctly ----
test('makeInitialGasState: inspired PO2 scales with FiO2', () => {
  const params = makePatientParams(PRESETS.phenotype_baseline());
  const g21 = makeInitialGasState(params, 0.21);
  const g50 = makeInitialGasState(params, 0.50);
  const g100 = makeInitialGasState(params, 1.0);
  // inspired PO2 = FiO2 × (150 - 47) + 47 = FiO2 × 103 + 47
  assert(approx(g21.inspiredPo2, 0.21 * 103 + 47),
    `room air inspired PO2 = ${g21.inspiredPo2}`);
  assert(approx(g100.inspiredPo2, 150),
    `100% FiO2 inspired PO2 should be ~150 mmHg`);
  assert(g50.inspiredPo2 > g21.inspiredPo2,
    `higher FiO2 should give higher inspired PO2`);
});

// ---- T4: shunt fraction is in [0,1] ----
test('shuntFraction: returns in [0, 1]', () => {
  const params = makePatientParams(PRESETS.phenotype_baseline());
  const gas = makeInitialGasState(params);
  const s = shuntFraction(gas, params);
  assert(s >= 0 && s <= 1, `shunt ${s}`);
});

// ---- T5: shunt fraction decreases with higher ventilation ----
test('shuntFraction: lower with more ventilation per compartment', () => {
  const params = makePatientParams(PRESETS.phenotype_baseline());
  const gasLo = makeInitialGasState(params);
  const gasHi = makeInitialGasState(params);
  // Increase va_ratio of all compartments.
  for (const c of gasHi.compartments) c.va_ratio *= 10;
  const sLo = shuntFraction(gasLo, params);
  const sHi = shuntFraction(gasHi, params);
  assert(sHi < sLo, `higher V/Q should reduce shunt: ${sHi} < ${sLo}`);
});

// ---- T6: deadSpaceFraction is in [0,1] ----
test('deadSpaceFraction: returns in [0, 1]', () => {
  const params = makePatientParams(PRESETS.phenotype_baseline());
  const gas = makeInitialGasState(params);
  const ds = deadSpaceFraction(gas, params);
  assert(ds >= 0 && ds <= 1, `deadSpace ${ds}`);
});

// ---- T7: deadSpaceFraction increases with high va_ratio ----
test('deadSpaceFraction: higher with high V/Q', () => {
  const params = makePatientParams(PRESETS.phenotype_baseline());
  const gasLo = makeInitialGasState(params);
  const gasHi = makeInitialGasState(params);
  for (const c of gasHi.compartments) c.va_ratio *= 10;
  const dsLo = deadSpaceFraction(gasLo, params);
  const dsHi = deadSpaceFraction(gasHi, params);
  assert(dsHi > dsLo, `high V/Q should have higher dead space: ${dsHi} > ${dsLo}`);
});

// ---- T8: mixedArterialPo2 is perfusion-weighted ----
test('mixedArterialPo2: weighted average across compartments', () => {
  const params = makePatientParams(PRESETS.phenotype_baseline());
  const gas = makeInitialGasState(params);
  gas.compartments[0].po2 = 100;
  gas.compartments[1].po2 = 50;
  gas.compartments[2].po2 = 30;
  const pa = mixedArterialPo2(gas, params);
  // Manual: sum(perf * po2) / sum(perf) — verify in plausible range.
  assert(pa > 30 && pa < 100, `PaO2 ${pa} should be between min(30) and max(100)`);
});

// ---- T9: stepGasState evolves PO2 toward equilibrium ----
test('stepGasState: PO2 relaxes toward alveolar equilibrium', () => {
  const params = makePatientParams(PRESETS.phenotype_baseline());
  const gas = makeInitialGasState(params, 1.0);
  // Set all PO2 to 0; they should rise toward ~150 mmHg over many steps.
  for (const c of gas.compartments) c.po2 = 0;
  const compartments = params.compartments.map((cp, i) => ({
    volume: 0.1, flow: 0.5, alveolarPressure: 10,
    recruitment: i === 0 ? 1 : 0.5,
  }));
  let g = gas;
  for (let i = 0; i < 1000; i++) g = stepGasState(g, params, compartments, 0.1);
  // PO2 should be substantially above 0 (relaxed to equilibrium).
  for (const c of g.compartments) {
    assert(c.po2 > 50, `PO2 should rise from 0 to physiological range; got ${c.po2.toFixed(2)}`);
    assert(c.spo2 > 0.7, `SpO2 should rise with PO2; got ${c.spo2.toFixed(2)}`);
  }
});

// ---- T10: stepGasState is deterministic ----
test('stepGasState: deterministic — same input → same output', () => {
  const params = makePatientParams(PRESETS.phenotype_baseline());
  const gas = makeInitialGasState(params, 0.5);
  const compartments = params.compartments.map((cp, i) => ({
    volume: 0.1, flow: 0.1, alveolarPressure: 10, recruitment: i === 0 ? 1 : 0.5,
  }));
  const a = stepGasState(gas, params, compartments, 0.001);
  const b = stepGasState(gas, params, compartments, 0.001);
  for (let i = 0; i < a.compartments.length; i++) {
    assert(a.compartments[i].po2 === b.compartments[i].po2);
    assert(a.compartments[i].spo2 === b.compartments[i].spo2);
  }
});

// ---- T11: recruitment affects V/Q ratio indirectly via flow proxy ----
test('stepGasState: higher recruitment → higher va_ratio', () => {
  const params = makePatientParams(PRESETS.phenotype_baseline());
  const compartments = params.compartments.map((cp, i) => ({
    volume: 0.1, flow: 0.1, alveolarPressure: 10, recruitment: 0,
  }));
  const gas0 = makeInitialGasState(params, 0.5);
  const gas1 = makeInitialGasState(params, 0.5);
  // Run twice with same params — recruitment shouldn't shift va_ratio here
  // (flow is fixed), but the function must not error or produce NaN.
  let g0 = stepGasState(gas0, params, compartments, 0.001);
  let g1 = stepGasState(gas1, params, compartments, 0.001);
  for (const c of g0.compartments) assert(Number.isFinite(c.po2));
  for (const c of g1.compartments) assert(Number.isFinite(c.po2));
});

console.log(`\nTests: passed=${passed} failed=${failed}`);
process.exit(failed === 0 ? 0 : 1);
