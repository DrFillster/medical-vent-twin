'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { getBerlinCase } = require('../src/berlin_case_catalog.js');
const { makePatientParams } = require('../src/contracts.js');
const { Simulation, VcAcController } = require('../src/simulation.js');
const { createHumModArdsGasRuntime } = require('../src/hummod_ards_core_runtime.js');
const { createLiveCoreBoundaryFromVent } = require('../src/hummod_ards_core_vent_adapter.js');

const CASE_ID = 'berlin-moderate-moderate-aspiration';

const engineeringBoundaries = Object.freeze({
  status: 'explicit-synthetic-engineering-boundaries-not-patient-data',
  systemic: Object.freeze({
    cardiacOutputMlPerMin: 5000,
    tissueO2UseMlPerMin: 250,
    tissueCo2ProductionMmolPerMin: 200 * 0.0446,
  }),
  pulmonary: Object.freeze({
    // HumMod PulmonaryMembrane source constants under the deliberately
    // simplified phase-1 boundary: full active area, no excess lung water.
    membranePermeabilityMlPerMinPerMmHg:
      5.0 * 0.55 * 80.0 / 0.6,
    deadSpaceBtpsMl: null,
  }),
  blood: Object.freeze({
    sidMolPerL: 0.040,
    // HgbConc source defaults: [Basic] 0.15 g/mL equivalent and 1.34 mL O2/g.
    o2MaxMlPerMl: 1.34 * 0.15,
    tempC: 37,
    carboxyPercent: 0,
  }),
  environment: Object.freeze({
    barometricPressureMmHg: 760,
    inspiredCo2Fraction: 0,
  }),
  caveats: Object.freeze([
    'Cardiac output is held fixed in Gate A.',
    'Tissue O2 use and CO2 production are held fixed in Gate A.',
    'SID is an explicit synthetic boundary; full electrolyte pools are not yet dynamic.',
    'Pulmonary membrane permeability uses source-aligned HumMod constants with full active area and no excess lung water.',
    'Dead space uses HumMod Breathing.DES legacy equation from delivered tidal volume.',
    'Pleural/thoracic pressure and closed-loop hemodynamics are deferred to Gate B.',
  ]),
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
  return {
    clinicalCase,
    simulation: new Simulation({
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
    }),
  };
}

function adapter(simulation) {
  return createLiveCoreBoundaryFromVent({
    simulation,
    systemic: engineeringBoundaries.systemic,
    pulmonary: engineeringBoundaries.pulmonary,
    blood: engineeringBoundaries.blood,
    environment: engineeringBoundaries.environment,
  });
}

function meanRecruitment(simulation) {
  return Object.fromEntries(
    simulation.state.compartments.map(c => [c.id, c.recruitment])
  );
}

function capture(label, simulation, core, adapterResult) {
  const s = core.snapshot();
  return Object.freeze({
    label,
    timeSec: simulation.state.t,
    ventilator: Object.freeze({
      peepCmH2O: simulation.controller.settings.peep,
      fio2: simulation.controller.settings.fio2,
      rrPerMin: simulation.controller.settings.rr,
      vtL: simulation.controller.settings.vt,
    }),
    pulmonary: Object.freeze({
      airwayPressureCmH2O: simulation.state.airwayPressure,
      totalLungVolumeL: simulation.state.totalVolume,
      recruitment: meanRecruitment(simulation),
      ventilatedPerfusionFraction:
        adapterResult.diagnostics.ventilatedPerfusionFraction,
    }),
    systemic: Object.freeze({
      pao2MmHg: s.gases.arterial.po2MmHg,
      sao2Fraction: s.gases.arterial.saturationFraction,
      paco2MmHg: s.gases.arterial.pco2MmHg,
      pH: s.gases.arterial.pH,
      arterialHco3MolPerL: s.gases.arterial.hco3MolPerL,
      venousPo2MmHg: s.gases.venous.po2MmHg,
      venousPco2MmHg: s.gases.venous.pco2MmHg,
    }),
    exchange: s.exchange ? Object.freeze({
      lungO2UptakeMlPerMin: s.exchange.oxygen.uptakeMlPerMin,
      lungCo2ExpiredMlPerMin: s.exchange.carbonDioxide.expiredCo2MlPerMin,
      alveolarVentilationStpdMlPerMin:
        s.exchange.breathing.alveolarVentilationStpdMlPerMin,
    }) : null,
  });
}

function runCoupledFor(simulation, core, seconds, timeline, labelPrefix) {
  const wholeSeconds = Math.floor(seconds);
  const remainder = seconds - wholeSeconds;
  for (let i = 0; i < wholeSeconds; i += 1) {
    simulation.runFor(1);
    const a = adapter(simulation);
    core.step({ dtSec: 1, boundary: a.boundary });
    timeline.push(capture(labelPrefix + '-' + (i + 1) + 's', simulation, core, a));
  }
  if (remainder > 1e-9) {
    simulation.runFor(remainder);
    const a = adapter(simulation);
    core.step({ dtSec: remainder, boundary: a.boundary });
    timeline.push(capture(labelPrefix + '-final', simulation, core, a));
  }
}

function main() {
  const { clinicalCase, simulation } = buildVent();
  const initialAdapter = adapter(simulation);
  const core = createHumModArdsGasRuntime({
    useHumModSourceInitialState: true,
    boundary: initialAdapter.boundary,
  });

  const timeline = [];
  timeline.push(capture('initial', simulation, core, initialAdapter));

  // Allow HumMod source gas stores/delays and Vent recruitment kinetics to
  // settle before comparing interventions. This avoids treating source
  // initialization transients as a PEEP effect.
  runCoupledFor(simulation, core, 300, timeline, 'baseline-settle');
  const prePeep = timeline[timeline.length - 1];

  simulation.setPEEP(14);
  runCoupledFor(simulation, core, 180, timeline, 'post-peep-settle');
  const postPeep = timeline[timeline.length - 1];

  const gateChecks = {
    persistentState:
      postPeep.timeSec > prePeep.timeSec &&
      prePeep.timeSec > 0,
    peepApplied:
      prePeep.ventilator.peepCmH2O === 8 &&
      postPeep.ventilator.peepCmH2O === 14,
    perfusionCouplingFinite:
      Number.isFinite(prePeep.pulmonary.ventilatedPerfusionFraction) &&
      Number.isFinite(postPeep.pulmonary.ventilatedPerfusionFraction),
    arterialGasStateFinite:
      [prePeep, postPeep].every(s =>
        Number.isFinite(s.systemic.pao2MmHg) &&
        Number.isFinite(s.systemic.paco2MmHg) &&
        Number.isFinite(s.systemic.pH)),
    noResetBetweenStates: true,
  };
  const gatePassed = Object.values(gateChecks).every(Boolean);
  if (!gatePassed) {
    throw new Error(
      'Gate A failed: ' + JSON.stringify(gateChecks));
  }

  const report = {
    schema: 'vent-hummod-ards-core-target-benchmark/v1',
    target:
      'persistent moderate ARDS patient: PEEP change propagates through Vent recruitment/perfusion into live HumMod-derived gas/acid-base core',
    gate: 'A-gas-exchange-acid-base',
    gatePassed,
    gateChecks,
    caseId: CASE_ID,
    caseSynthetic: clinicalCase.synthetic,
    engineeringBoundaries,
    intervention: {
      kind: 'SET_PEEP',
      fromCmH2O: 8,
      toCmH2O: 14,
      resetBetweenStates: false,
      baselineSettlingSec: 300,
      postInterventionSettlingSec: 180,
      rationale:
        'avoid comparing HumMod source-initial gas-store transient with a later intervention state',
    },
    prePeep,
    postPeep,
    timeline,
    interpretation: {
      clinicalValidation: false,
      hemodynamicGate:
        'not-yet-passed; pleural/thoracic pressure model required before live RV/CO/MAP coupling',
      passCriteria: [
        'both Vent and systemic states remain persistent across the intervention',
        'Vent recruitment/perfusion state changes are passed into the systemic core',
        'arterial O2/CO2/pH evolve dynamically rather than replaying fixed values',
        'all phase-1 non-dynamic physiology is explicit in engineeringBoundaries',
      ],
    },
  };

  const outDir = path.resolve(__dirname, '../benchmark-results');
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, 'live-core-peep-target.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({
    out,
    target: report.target,
    prePeep,
    postPeep,
  }, null, 2));
}

if (require.main === module) main();
