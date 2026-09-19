'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { getBerlinCase } = require('../src/berlin_case_catalog.js');
const { makePatientParams } = require('../src/contracts.js');
const { Simulation, VcAcController } = require('../src/simulation.js');
const { createHumModArdsGasRuntime } = require('../src/hummod_ards_core_runtime.js');
const { createLiveCoreBoundaryFromVent } = require('../src/hummod_ards_core_vent_adapter.js');
const { createThoraxState } = require('../src/hummod_ards_core_thorax.js');
const { createHumModArdsCirculation } = require('../src/hummod_ards_core_circulation.js');
const { createHumModArdsCardiopulmonaryRuntime } = require('../src/hummod_ards_cardiopulmonary_runtime.js');
const { cmH2OToMmHg } = require('../src/clinical_units.js');

const CASE_ID = 'berlin-moderate-moderate-aspiration';

const syntheticEngineeringBoundaries = Object.freeze({
  status: 'explicit-synthetic-engineering-boundaries-not-patient-data',
  thorax: Object.freeze({
    referencePleuralPressureCmH2O: 6,
    chestWallElastanceFraction: 0.25,
    pericardialTmpMmHg: 0,
    provenance: Object.freeze({
      kind: 'synthetic-engineering-assumption',
      note:
        'Phase-1 thorax values are explicit placeholders, not inferred from Berlin severity or recruitability.',
    }),
  }),
  circulation: Object.freeze({
    initialVolumesMl: Object.freeze({
      systemicArteries: 999,
      systemicVeins: 2675,
      rightAtrium: 51,
      pulmonaryArtery: 201,
      pulmonaryCapillaries: 200,
      pulmonaryVeins: 211,
      leftAtrium: 51,
    }),
    boundaries: Object.freeze({
      heartRatePerMin: 75,
      systemicArterialConductanceMlPerMinPerMmHg: 60,
      systemicVenousConductanceMlPerMinPerMmHg: 692,
      rightContractilityMultiplier: 1,
      leftContractilityMultiplier: 1,
      rightStiffnessMultiplier: 1,
      leftStiffnessMultiplier: 1,
    }),
  }),
  gas: Object.freeze({
    systemic: Object.freeze({
      tissueO2UseMlPerMin: 250,
      tissueCo2ProductionMmolPerMin: 200 * 0.0446,
    }),
    pulmonary: Object.freeze({
      membranePermeabilityMlPerMinPerMmHg:
        5.0 * 0.55 * 80.0 / 0.6,
      deadSpaceBtpsMl: null,
    }),
    blood: Object.freeze({
      sidMolPerL: 0.040,
      o2MaxMlPerMl: 1.34 * 0.15,
      tempC: 37,
      carboxyPercent: 0,
    }),
    environment: Object.freeze({
      barometricPressureMmHg: 760,
      inspiredCo2Fraction: 0,
    }),
  }),
});

function buildVent() {
  const clinicalCase = getBerlinCase(CASE_ID);
  const params = makePatientParams(clinicalCase.phenotype.mechanicsParams);
  const controller = new VcAcController({
    fio2: 0.60,
    peep: 8,
    rr: 20,
    vt: 0.42,
    inspiratoryFlow: 0.70,
    inspiratoryPause: 0.20,
  });
  const simulation = new Simulation({
    params,
    controller,
    dt: 0.002,
    trackGas: false,
    initialPEEP: 8,
    initialRecruitmentState: {
      normal: 1,
      recruitable: 0.35,
      consolidated: 0,
    },
  });
  return { clinicalCase, simulation };
}

function meanAirwayPressure(simulation, samples = 1500) {
  const trace = simulation.trace.slice(-samples);
  if (!trace.length) return simulation.state.airwayPressure;
  return trace.reduce((sum, row) => sum + row.airwayPressure, 0) / trace.length;
}

function makeGasBoundary(simulation, cardiacOutputMlPerMin) {
  return createLiveCoreBoundaryFromVent({
    simulation,
    systemic: {
      ...syntheticEngineeringBoundaries.gas.systemic,
      cardiacOutputMlPerMin,
    },
    pulmonary: syntheticEngineeringBoundaries.gas.pulmonary,
    blood: syntheticEngineeringBoundaries.gas.blood,
    environment: syntheticEngineeringBoundaries.gas.environment,
  });
}

function capture(label, simulation, runtime) {
  const s = runtime.snapshot();
  const last = s.lastStep;
  const circ = last.circulation;
  const gas = last.gas;
  return Object.freeze({
    label,
    timeSec: simulation.state.t,
    ventilator: Object.freeze({
      peepCmH2O: simulation.controller.settings.peep,
      fio2: simulation.controller.settings.fio2,
      rrPerMin: simulation.controller.settings.rr,
      vtL: simulation.controller.settings.vt,
    }),
    mechanics: Object.freeze({
      meanAirwayPressureCmH2O: last.meanAirwayPressureCmH2O,
      totalLungVolumeL: simulation.state.totalVolume,
      recruitment: Object.fromEntries(
        simulation.state.compartments.map(c => [c.id, c.recruitment])
      ),
    }),
    thorax: Object.freeze({
      pleuralPressureCmH2O: last.thorax.pleuralPressureCmH2O,
      transpulmonaryPressureCmH2O: last.thorax.transpulmonaryPressureCmH2O,
      thoracicPressureMmHg: last.thoracicPressureMmHg,
    }),
    circulation: Object.freeze({
      mapMmHg: circ.pressures.systemicArterialMmHg,
      rightAtrialPressureMmHg: circ.pressures.rightAtrialMmHg,
      pulmonaryArteryPressureMmHg: circ.pressures.pulmonaryArteryMmHg,
      leftAtrialPressureMmHg: circ.pressures.leftAtrialMmHg,
      cardiacOutputMlPerMin: circ.flowsMlPerMin.leftVentricular,
      rightVentricularFlowMlPerMin: circ.flowsMlPerMin.rightVentricular,
      totalVascularVolumeMl:
        Object.values(circ.volumesMl).reduce((a, b) => a + b, 0),
      rightVentricle: circ.rightVentricle,
      leftVentricle: circ.leftVentricle,
    }),
    gas: Object.freeze({
      pao2MmHg: gas.gases.arterial.po2MmHg,
      paco2MmHg: gas.gases.arterial.pco2MmHg,
      pH: gas.gases.arterial.pH,
      sao2Fraction: gas.gases.arterial.saturationFraction,
    }),
    coupling: Object.freeze({
      ventilatedPerfusionFraction:
        last.adapterDiagnostics.ventilatedPerfusionFraction,
    }),
  });
}

function runCoupled(simulation, runtime, seconds, timeline, prefix) {
  for (let i = 0; i < seconds; i += 1) {
    simulation.runFor(1);
    runtime.step({ dtSec: 1 });
    timeline.push(capture(prefix + '-' + (i + 1) + 's', simulation, runtime));
  }
}

function main() {
  const { clinicalCase, simulation } = buildVent();

  // Mechanical pre-settle before defining the thorax reference state.
  simulation.runFor(60);
  const referenceMeanAirwayPressureCmH2O = meanAirwayPressure(simulation);

  const thorax = createThoraxState({
    referenceAirwayPressureCmH2O: referenceMeanAirwayPressureCmH2O,
    referencePleuralPressureCmH2O:
      syntheticEngineeringBoundaries.thorax.referencePleuralPressureCmH2O,
    chestWallElastanceFraction:
      syntheticEngineeringBoundaries.thorax.chestWallElastanceFraction,
    provenance: syntheticEngineeringBoundaries.thorax.provenance,
  });

  const circulation = createHumModArdsCirculation({
    initialVolumesMl:
      syntheticEngineeringBoundaries.circulation.initialVolumesMl,
    boundaries: syntheticEngineeringBoundaries.circulation.boundaries,
    maxSubstepSec: 0.005,
  });

  // Prime the circulation at the reference thorax state to obtain a
  // source-aligned cardiac output for the initial gas boundary.
  const baselineThorax = thorax.atStaticAirwayPressure(
    referenceMeanAirwayPressureCmH2O);
  const baselineThoracicPressureMmHg =
    cmH2OToMmHg(baselineThorax.pleuralPressureCmH2O);
  const primedCirc = circulation.step({
    dtSec: 0.01,
    thoracicPressureMmHg: baselineThoracicPressureMmHg,
    pericardialPressureMmHg:
      baselineThoracicPressureMmHg +
      syntheticEngineeringBoundaries.thorax.pericardialTmpMmHg,
  });
  const initialCardiacOutputMlPerMin =
    primedCirc.flowsMlPerMin.leftVentricular;

  const initialGasBoundary =
    makeGasBoundary(simulation, initialCardiacOutputMlPerMin);
  const gasRuntime = createHumModArdsGasRuntime({
    useHumModSourceInitialState: true,
    boundary: initialGasBoundary.boundary,
  });

  const runtime = createHumModArdsCardiopulmonaryRuntime({
    simulation,
    thorax,
    circulation,
    gasRuntime,
    pressureAdapter: { cmH2OToMmHg },
    systemicBoundaries: syntheticEngineeringBoundaries.gas.systemic,
    pulmonaryBoundaries: syntheticEngineeringBoundaries.gas.pulmonary,
    bloodBoundaries: syntheticEngineeringBoundaries.gas.blood,
    environmentBoundaries: syntheticEngineeringBoundaries.gas.environment,
    pericardialTmpMmHg:
      syntheticEngineeringBoundaries.thorax.pericardialTmpMmHg,
  });

  const timeline = [];
  runCoupled(simulation, runtime, 30, timeline, 'baseline');
  const prePeep = timeline[timeline.length - 1];

  simulation.setPEEP(14);
  runCoupled(simulation, runtime, 30, timeline, 'post-peep');
  const postPeep = timeline[timeline.length - 1];

  const volumeDriftMl =
    postPeep.circulation.totalVascularVolumeMl -
    prePeep.circulation.totalVascularVolumeMl;

  const checks = {
    persistentState: postPeep.timeSec > prePeep.timeSec,
    peepApplied:
      prePeep.ventilator.peepCmH2O === 8 &&
      postPeep.ventilator.peepCmH2O === 14,
    finiteCirculation:
      [prePeep, postPeep].every(s =>
        Number.isFinite(s.circulation.mapMmHg) &&
        Number.isFinite(s.circulation.cardiacOutputMlPerMin) &&
        Number.isFinite(s.circulation.rightAtrialPressureMmHg) &&
        Number.isFinite(s.circulation.pulmonaryArteryPressureMmHg)),
    finiteGas:
      [prePeep, postPeep].every(s =>
        Number.isFinite(s.gas.pao2MmHg) &&
        Number.isFinite(s.gas.paco2MmHg) &&
        Number.isFinite(s.gas.pH)),
    conservedVascularVolume: Math.abs(volumeDriftMl) < 1e-6,
  };

  const report = {
    schema: 'vent-hummod-cardiopulmonary-target-benchmark/v1',
    target:
      'persistent moderate ARDS patient: PEEP change propagates through Vent, explicit thorax, reduced HumMod circulation, cardiac output, and HumMod gas core',
    gate: 'B-cardiopulmonary-feedback-provisional',
    gatePassed: Object.values(checks).every(Boolean),
    checks,
    caseId: CASE_ID,
    caseSynthetic: clinicalCase.synthetic,
    syntheticEngineeringBoundaries,
    referenceMeanAirwayPressureCmH2O,
    intervention: {
      kind: 'SET_PEEP',
      fromCmH2O: 8,
      toCmH2O: 14,
      resetBetweenStates: false,
    },
    prePeep,
    postPeep,
    deltas: {
      meanAirwayPressureCmH2O:
        postPeep.mechanics.meanAirwayPressureCmH2O -
        prePeep.mechanics.meanAirwayPressureCmH2O,
      pleuralPressureCmH2O:
        postPeep.thorax.pleuralPressureCmH2O -
        prePeep.thorax.pleuralPressureCmH2O,
      mapMmHg:
        postPeep.circulation.mapMmHg -
        prePeep.circulation.mapMmHg,
      cardiacOutputMlPerMin:
        postPeep.circulation.cardiacOutputMlPerMin -
        prePeep.circulation.cardiacOutputMlPerMin,
      rightAtrialPressureMmHg:
        postPeep.circulation.rightAtrialPressureMmHg -
        prePeep.circulation.rightAtrialPressureMmHg,
      pulmonaryArteryPressureMmHg:
        postPeep.circulation.pulmonaryArteryPressureMmHg -
        prePeep.circulation.pulmonaryArteryPressureMmHg,
      pao2MmHg: postPeep.gas.pao2MmHg - prePeep.gas.pao2MmHg,
      paco2MmHg: postPeep.gas.paco2MmHg - prePeep.gas.paco2MmHg,
      pH: postPeep.gas.pH - prePeep.gas.pH,
      vascularVolumeDriftMl: volumeDriftMl,
    },
    interpretation: {
      clinicalValidation: false,
      blockingStatus:
        'provisional engineering benchmark; inspect direction and stability before promotion to hard Gate B',
      thoraxCaveat:
        'baseline pleural pressure and chest-wall elastance fraction are explicit synthetic inputs, not patient measurements',
    },
    timeline,
  };

  const outDir = path.resolve(__dirname, '../benchmark-results');
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, 'live-cardiopulmonary-peep-target.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({
    out,
    gatePassed: report.gatePassed,
    checks,
    prePeep,
    postPeep,
    deltas: report.deltas,
  }, null, 2));

  if (!report.gatePassed) {
    process.exitCode = 1;
  }
}

if (require.main === module) main();
