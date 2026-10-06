'use strict';

const {
  createHumModArdsHemodynamicRuntime,
} = require('../src/hummod_ards_core_hemodynamic_runtime.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log('ok -', name); passed += 1; }
  catch (e) { console.error('FAIL -', name, ':', e.message); failed += 1; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function near(a,b,tol=1e-8){ assert(Math.abs(a-b)<=tol, a+' != '+b); }

function initialState() {
  return {
    systemicArterialVolumeMl: 999,
    systemicVenousVolumeMl: 2410,
    rightAtrialVolumeMl: 51,
    pulmonaryArterialVolumeMl: 201,
    pulmonaryCapillaryVolumeMl: 200,
    pulmonaryVenousVolumeMl: 211,
    leftAtrialVolumeMl: 51,
  };
}

function boundary({ thoracicPressureMmHg = 0 } = {}) {
  return {
    heartRatePerMin: 75,
    rightContractilityMultiplier: 1,
    leftContractilityMultiplier: 1,
    rightStiffnessMultiplier: 1,
    leftStiffnessMultiplier: 1,
    thoracicPressureMmHg,
    pericardialTmpMmHg: 0,
    systemicVenousV0Ml: 1700,
    systemicVenousComplianceMlPerMmHg: 88.6,
    venousReturnConductanceMlPerMinPerMmHg: 1300,
    systemicRunoffConductanceMlPerMinPerMmHg: 60,
  };
}

function totalVolume(state) {
  return Object.values(state).reduce((a,b) => a+b, 0);
}

test('baseline snapshot produces finite HumMod-native pressures and pump flows', () => {
  const r = createHumModArdsHemodynamicRuntime({
    initialState: initialState(),
    boundary: boundary(),
  });
  const s = r.snapshot();
  assert(Number.isFinite(s.calculated.pressuresMmHg.systemicArtery));
  assert(Number.isFinite(s.calculated.pressuresMmHg.pulmonaryArtery));
  assert(s.calculated.flowsMlPerMin.rightPump > 0);
  assert(s.calculated.flowsMlPerMin.leftPump > 0);
  assert(s.provenance.fullHumModEquivalent === false);
});

test('raising thoracic pressure raises pulmonary artery pressure at fixed volume', () => {
  const base = createHumModArdsHemodynamicRuntime({
    initialState: initialState(),
    boundary: boundary({ thoracicPressureMmHg: 0 }),
  }).snapshot();

  const raised = createHumModArdsHemodynamicRuntime({
    initialState: initialState(),
    boundary: boundary({ thoracicPressureMmHg: 5 }),
  }).snapshot();

  near(
    raised.calculated.pressuresMmHg.pulmonaryArtery -
      base.calculated.pressuresMmHg.pulmonaryArtery,
    5
  );
  assert(
    raised.calculated.flowsMlPerMin.venousReturn <
      base.calculated.flowsMlPerMin.venousReturn,
    'higher thoracic/pericardial pressure should reduce systemic venous return gradient'
  );
});

test('one reduced-order circulation step conserves modeled blood volume', () => {
  const r = createHumModArdsHemodynamicRuntime({
    initialState: initialState(),
    boundary: boundary(),
  });
  const before = r.snapshot();
  const after = r.step({ dtSec: 0.01 });
  near(totalVolume(before.state), totalVolume(after.state), 1e-7);
});

test('hemodynamic runtime preserves explicit reduced-order provenance', () => {
  const s = createHumModArdsHemodynamicRuntime({
    initialState: initialState(),
    boundary: boundary(),
  }).snapshot();
  assert(s.provenance.status.includes('reduced-order-adaptation'));
  assert(s.provenance.systemicReduction.includes('collapsed'));
  assert(s.provenance.clinicalValidation === false);
});

console.log('\nTests: passed=' + passed + ' failed=' + failed);
process.exit(failed === 0 ? 0 : 1);
