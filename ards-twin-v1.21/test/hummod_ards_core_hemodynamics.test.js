'use strict';

const {
  VASCULAR_DEFAULTS,
  stressedVolumePressure,
  conductanceFlow,
  pericardialPressure,
  ventricularPump,
} = require('../src/hummod_ards_core_hemodynamics.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log('ok -', name); passed += 1; }
  catch (e) { console.error('FAIL -', name, ':', e.message); failed += 1; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function near(a,b,tol=1e-10){ assert(Math.abs(a-b)<=tol, a+' != '+b); }

test('pulmonary artery pressure follows HumMod stressed-volume equation', () => {
  const p = VASCULAR_DEFAULTS.pulmonaryArtery;
  const out = stressedVolumePressure({
    volumeMl: p.initialVolumeMl,
    v0Ml: p.v0Ml,
    complianceMlPerMmHg: p.complianceMlPerMmHg,
    externalPressureMmHg: 2,
  });
  near(out.stressedVolumeMl, 91);
  near(out.pressureMmHg, (91 / 5.3) + 2);
});

test('right and left atrial pressure may use unclamped stressed volume', () => {
  const out = stressedVolumePressure({
    volumeMl: 51,
    v0Ml: 0,
    complianceMlPerMmHg: 12.5,
    externalPressureMmHg: 3,
    clampStressedVolumeAtZero: false,
  });
  near(out.pressureMmHg, (51 / 12.5) + 3);
});

test('conductance flow matches HumMod pressure-gradient algebra', () => {
  near(conductanceFlow({
    conductanceMlPerMinPerMmHg: 100,
    upstreamPressureMmHg: 15,
    downstreamPressureMmHg: 10,
  }), 500);
});

test('pericardial pressure follows Thorax plus pericardial TMP', () => {
  near(pericardialPressure({
    thoracicPressureMmHg: 4,
    pericardialTmpMmHg: 1.5,
  }), 5.5);
});

test('right ventricular pump reproduces source algebra', () => {
  const out = ventricularPump({
    side: 'right',
    atrialPressureMmHg: 6,
    arterialPressureMmHg: 15,
    pericardialPressureMmHg: 2,
    heartRatePerMin: 80,
    contractilityMultiplier: 1,
    stiffnessMultiplier: 1,
  });
  const expectedEdv = Math.pow((6 - 2) / 0.00026, 1 / 2);
  const expectedEsv = Math.pow(((15 + 9) - 2) / 3.53, 1 / 0.5);
  near(out.edvMl, expectedEdv);
  near(out.esvMl, expectedEsv);
  near(out.strokeVolumeMl, expectedEdv - expectedEsv);
  near(out.bloodFlowMlPerMin, 80 * (expectedEdv - expectedEsv));
});

test('left ventricular pump uses source-specific constants', () => {
  const out = ventricularPump({
    side: 'left',
    atrialPressureMmHg: 8,
    arterialPressureMmHg: 80,
    pericardialPressureMmHg: 2,
    heartRatePerMin: 75,
  });
  const expectedEdv = Math.pow((8 - 2) / 0.00051, 1 / 2);
  const expectedEsv = Math.pow(((80 + 24) - 2) / 17.39, 1 / 0.5);
  near(out.edvMl, expectedEdv);
  near(out.esvMl, expectedEsv);
});

test('pump rejects negative transmural pressures instead of inventing behavior', () => {
  let threw = false;
  try {
    ventricularPump({
      side: 'right',
      atrialPressureMmHg: 1,
      arterialPressureMmHg: 15,
      pericardialPressureMmHg: 2,
      heartRatePerMin: 80,
    });
  } catch (_) { threw = true; }
  assert(threw);
});

console.log('\nTests: passed=' + passed + ' failed=' + failed);
process.exit(failed === 0 ? 0 : 1);
