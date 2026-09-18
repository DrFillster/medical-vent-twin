'use strict';

const {
  HUMMOD_SOURCE_INITIAL_GAS_STATE,
  firstOrderDelayExact,
  createHumModArdsGasRuntime,
} = require('../src/hummod_ards_core_runtime.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log('ok -', name); passed += 1; }
  catch (e) { console.error('FAIL -', name, ':', e.message); failed += 1; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function near(a,b,tol=1e-10){ assert(Math.abs(a-b)<=tol, a+' != '+b); }

function boundary({
  fio2 = 0.21,
  rr = 20,
  vt = 500,
  deadSpace = 150,
} = {}) {
  return {
    ventilation: {
      respiratoryRatePerMin: rr,
      tidalVolumeBtpsMl: vt,
      deadSpaceBtpsMl: deadSpace,
      fio2,
    },
    pulmonary: {
      membranePermeabilityMlPerMinPerMmHg: 1000,
      ventilatedPulmonaryBloodFlowMlPerMin: 5000,
    },
    circulation: {
      cardiacOutputMlPerMin: 5000,
    },
    metabolism: {
      tissueO2UseMlPerMin: 250,
      tissueCo2ProductionMmolPerMin: 8.92,
    },
    blood: {
      sidMolPerL: 0.04,
      o2MaxMlPerMl: 0.2,
      tempC: 37,
      carboxyPercent: 0,
    },
    environment: {
      barometricPressureMmHg: 760,
      inspiredCo2Fraction: 0,
    },
  };
}

test('first-order delay follows documented HumMod delay differential equation', () => {
  const out = firstOrderDelayExact({
    output: 0,
    input: 1,
    rateConstantPerMin: 5,
    dtSec: 60,
  });
  near(out, 1 - Math.exp(-5));
});

test('runtime advances source-state blood gases with explicit boundaries', () => {
  const runtime = createHumModArdsGasRuntime({
    useHumModSourceInitialState: true,
    boundary: boundary(),
  });
  const before = runtime.snapshot();
  const after = runtime.step({ dtSec: 1 });
  assert(before.timeSec === 0);
  assert(after.timeSec === 1);
  assert(Number.isFinite(after.gases.arterial.po2MmHg));
  assert(Number.isFinite(after.gases.arterial.pco2MmHg));
  assert(Number.isFinite(after.gases.arterial.pH));
  assert(after.exchange.oxygen.uptakeMlPerMin > 0);
  assert(after.exchange.carbonDioxide.expiredCo2MlPerMin > 0);
  assert(after.provenance.clinicalValidation === false);
});

test('higher FiO2 raises arterial oxygen state under otherwise identical boundaries', () => {
  const low = createHumModArdsGasRuntime({
    initialState: { ...HUMMOD_SOURCE_INITIAL_GAS_STATE },
    boundary: boundary({ fio2: 0.21 }),
  });
  const high = createHumModArdsGasRuntime({
    initialState: { ...HUMMOD_SOURCE_INITIAL_GAS_STATE },
    boundary: boundary({ fio2: 0.60 }),
  });

  let lowSnap, highSnap;
  for (let i = 0; i < 30; i += 1) {
    lowSnap = low.step({ dtSec: 1 });
    highSnap = high.step({ dtSec: 1 });
  }

  assert(
    highSnap.state.arterialO2ContentMlPerMl >
      lowSnap.state.arterialO2ContentMlPerMl,
    'higher FiO2 should increase arterial O2 content in the reduced core'
  );
});

test('lower minute ventilation raises arterial PCO2 under identical metabolism', () => {
  const normal = createHumModArdsGasRuntime({
    initialState: { ...HUMMOD_SOURCE_INITIAL_GAS_STATE },
    boundary: boundary({ rr: 20 }),
  });
  const lowVent = createHumModArdsGasRuntime({
    initialState: { ...HUMMOD_SOURCE_INITIAL_GAS_STATE },
    boundary: boundary({ rr: 10 }),
  });

  let a, b;
  for (let i = 0; i < 45; i += 1) {
    a = normal.step({ dtSec: 1 });
    b = lowVent.step({ dtSec: 1 });
  }

  assert(
    b.gases.arterial.pco2MmHg > a.gases.arterial.pco2MmHg,
    'lower ventilation should increase arterial PCO2'
  );
});

test('runtime refuses hidden defaults for dead space and physiology boundaries', () => {
  const bad = boundary();
  delete bad.ventilation.deadSpaceBtpsMl;
  let threw = false;
  try {
    createHumModArdsGasRuntime({
      useHumModSourceInitialState: true,
      boundary: bad,
    });
  } catch (_) { threw = true; }
  assert(threw);
});

console.log('\nTests: passed=' + passed + ' failed=' + failed);
process.exit(failed === 0 ? 0 : 1);
