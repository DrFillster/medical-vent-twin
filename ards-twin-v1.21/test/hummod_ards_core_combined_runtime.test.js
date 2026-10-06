'use strict';

const {
  createHumModArdsCombinedRuntime,
  buildDynamicGasBoundary,
} = require('../src/hummod_ards_core_combined_runtime.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log('ok -', name); passed += 1; }
  catch (e) { console.error('FAIL -', name, ':', e.message); failed += 1; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

function hemoInitial() {
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

function hemoBoundary({ thoracicPressureMmHg = 0 } = {}) {
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

function gasTemplate({ fio2 = 0.21 } = {}) {
  return {
    ventilation: {
      respiratoryRatePerMin: 20,
      tidalVolumeBtpsMl: 500,
      deadSpaceBtpsMl: 150,
      fio2,
    },
    pulmonary: {
      membranePermeabilityMlPerMinPerMmHg: 1000,
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

function makeCombined({ fio2 = 0.21, perfusion = 0.9 } = {}) {
  return createHumModArdsCombinedRuntime({
    useHumModSourceInitialGasState: true,
    hemodynamicInitialState: hemoInitial(),
    hemodynamicBoundary: hemoBoundary(),
    gasBoundaryTemplate: gasTemplate({ fio2 }),
    ventilatedPerfusionFraction: perfusion,
  });
}

test('combined runtime feeds dynamic hemodynamic flows into gas boundary', () => {
  const r = makeCombined();
  const s = r.snapshot();
  assert(s.coupling.cardiacOutputMlPerMin > 0);
  assert(s.coupling.totalPulmonaryBloodFlowMlPerMin > 0);
  assert(
    s.coupling.ventilatedPulmonaryBloodFlowMlPerMin <
      s.coupling.totalPulmonaryBloodFlowMlPerMin
  );
  assert(
    s.gases.boundary.circulation.cardiacOutputMlPerMin ===
      s.coupling.cardiacOutputMlPerMin
  );
});

test('combined runtime advances hemodynamics and blood gases on one clock', () => {
  const r = makeCombined();
  const s = r.step({ dtSec: 0.05 });
  assert(s.timeSec === 0.05);
  assert(s.hemodynamics.timeSec === 0.05);
  assert(s.gases.timeSec === 0.05);
  assert(Number.isFinite(s.gases.gases.arterial.po2MmHg));
  assert(Number.isFinite(s.hemodynamics.calculated.pressuresMmHg.pulmonaryArtery));
});

test('higher FiO2 still raises arterial oxygen in fully composed core', () => {
  const low = makeCombined({ fio2: 0.21 });
  const high = makeCombined({ fio2: 0.60 });

  let lowSnap, highSnap;
  for (let i = 0; i < 300; i += 1) {
    lowSnap = low.step({ dtSec: 0.05 });
    highSnap = high.step({ dtSec: 0.05 });
  }

  assert(
    highSnap.gases.state.arterialO2ContentMlPerMl >
      lowSnap.gases.state.arterialO2ContentMlPerMl
  );
});

test('ventilated perfusion fraction remains explicit and changes gas boundary', () => {
  const full = makeCombined({ perfusion: 1.0 }).snapshot();
  const partial = makeCombined({ perfusion: 0.5 }).snapshot();

  assert(
    partial.coupling.ventilatedPulmonaryBloodFlowMlPerMin <
      full.coupling.ventilatedPulmonaryBloodFlowMlPerMin
  );
  assert(
    partial.provenance.unresolvedPerfusionMapping.includes('explicit boundary')
  );
});

test('dynamic gas boundary uses HumMod pulmonary-flow ownership', () => {
  const fake = {
    calculated: {
      flowsMlPerMin: {
        leftPump: 5000,
        pulmonaryArtery: 4800,
        pulmonaryCapillary: 5200,
      },
    },
  };
  const b = buildDynamicGasBoundary({
    gasBoundaryTemplate: gasTemplate(),
    hemodynamicSnapshot: fake,
    ventilatedPerfusionFraction: 0.8,
  });
  assert(b.circulation.cardiacOutputMlPerMin === 5000);
  assert(b.pulmonary.ventilatedPulmonaryBloodFlowMlPerMin === 4000);
});

console.log('\nTests: passed=' + passed + ' failed=' + failed);
process.exit(failed === 0 ? 0 : 1);
