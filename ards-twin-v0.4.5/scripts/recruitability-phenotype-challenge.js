'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { getBerlinCase } = require('../src/berlin_case_catalog.js');
const { makePatientParams } = require('../src/contracts.js');
const { Simulation, VcAcController } = require('../src/simulation.js');
const {
  createLiveCoreBoundaryFromVent,
} = require('../src/hummod_ards_core_vent_adapter.js');

const CASES = Object.freeze([
  ['low', 'berlin-moderate-low-focal-pneumonia'],
  ['moderate', 'berlin-moderate-moderate-aspiration'],
  ['high', 'berlin-moderate-high-sepsis'],
]);

// Deliberately supra-routine engineering stress condition chosen to cross
// authored opening-pressure anchors. This is not a clinical PEEP
// recommendation or a recruitment-maneuver protocol.
const CHALLENGE = Object.freeze({
  baselinePeepCmH2O: 8,
  challengePeepCmH2O: 18,
  baselineSec: 90,
  challengeSec: 90,
  fio2: 0.60,
  rrPerMin: 20,
  vtL: 0.42,
  inspiratoryFlowLps: 0.70,
  inspiratoryPauseSec: 0.20,
});

const SYSTEMIC_BOUNDARY = Object.freeze({
  cardiacOutputMlPerMin: 5000,
  tissueO2UseMlPerMin: 250,
  tissueCo2ProductionMmolPerMin: 200 * 0.0446,
});
const PULMONARY_BOUNDARY = Object.freeze({
  membranePermeabilityMlPerMinPerMmHg: 5.0 * 0.55 * 80.0 / 0.6,
  deadSpaceBtpsMl: null,
});
const BLOOD_BOUNDARY = Object.freeze({
  sidMolPerL: 0.040,
  o2MaxMlPerMl: 1.34 * 0.15,
  tempC: 37,
  carboxyPercent: 0,
});
const ENVIRONMENT_BOUNDARY = Object.freeze({
  barometricPressureMmHg: 760,
  inspiredCo2Fraction: 0,
});

function buildSimulation(caseId) {
  const clinicalCase = getBerlinCase(caseId);
  const params = makePatientParams(clinicalCase.phenotype.mechanicsParams);
  const controller = new VcAcController({
    fio2: CHALLENGE.fio2,
    peep: CHALLENGE.baselinePeepCmH2O,
    rr: CHALLENGE.rrPerMin,
    vt: CHALLENGE.vtL,
    inspiratoryFlow: CHALLENGE.inspiratoryFlowLps,
    inspiratoryPause: CHALLENGE.inspiratoryPauseSec,
  });
  const simulation = new Simulation({
    params,
    controller,
    dt: 0.002,
    trackGas: false,
    initialPEEP: CHALLENGE.baselinePeepCmH2O,
    initialRecruitmentState: {
      normal: 1,
      recruitable: 0.35,
      consolidated: 0,
    },
  });
  return { clinicalCase, simulation };
}

function capture(simulation, clinicalCase) {
  const recruitable = simulation.state.compartments.find(
    c => c.id === 'recruitable');
  const adapter = createLiveCoreBoundaryFromVent({
    simulation,
    systemic: SYSTEMIC_BOUNDARY,
    pulmonary: PULMONARY_BOUNDARY,
    blood: BLOOD_BOUNDARY,
    environment: ENVIRONMENT_BOUNDARY,
  });
  return Object.freeze({
    timeSec: simulation.state.t,
    peepCmH2O: simulation.controller.settings.peep,
    totalLungVolumeL: simulation.state.totalVolume,
    recruitableFraction: recruitable.recruitment,
    ventilatedPerfusionFraction:
      adapter.diagnostics.ventilatedPerfusionFraction,
    recruitmentCalibration:
      clinicalCase.phenotype.recruitmentCalibration,
  });
}

function runOne(label, caseId) {
  const { clinicalCase, simulation } = buildSimulation(caseId);
  simulation.runFor(CHALLENGE.baselineSec);
  const baseline = capture(simulation, clinicalCase);
  simulation.setPEEP(CHALLENGE.challengePeepCmH2O);
  simulation.runFor(CHALLENGE.challengeSec);
  const challenged = capture(simulation, clinicalCase);

  return Object.freeze({
    label,
    caseId,
    berlinSeverity: clinicalCase.clinical.berlinSeverity,
    phenotypeRecruitability: clinicalCase.phenotype.recruitability,
    baseline,
    challenged,
    deltas: Object.freeze({
      recruitment:
        challenged.recruitableFraction - baseline.recruitableFraction,
      ventilatedPerfusionFraction:
        challenged.ventilatedPerfusionFraction -
        baseline.ventilatedPerfusionFraction,
      totalLungVolumeL:
        challenged.totalLungVolumeL - baseline.totalLungVolumeL,
    }),
  });
}

function main() {
  const results = CASES.map(([label, caseId]) => runOne(label, caseId));
  const byLabel = Object.fromEntries(results.map(x => [x.label, x]));

  const checks = Object.freeze({
    sameBerlinSeverity:
      results.every(x => x.berlinSeverity === 'moderate'),
    sameVentilatorChallenge:
      results.every(x =>
        x.baseline.peepCmH2O === CHALLENGE.baselinePeepCmH2O &&
        x.challenged.peepCmH2O === CHALLENGE.challengePeepCmH2O),
    finiteState:
      results.every(x =>
        Number.isFinite(x.challenged.recruitableFraction) &&
        Number.isFinite(x.challenged.ventilatedPerfusionFraction) &&
        Number.isFinite(x.challenged.totalLungVolumeL)),
    distinctOpeningAnchors:
      new Set(results.map(
        x => x.recruitmentCalibration.P_open)).size === 3,
    highRespondsMoreThanLow:
      byLabel.high.deltas.recruitment >
        byLabel.low.deltas.recruitment,
  });

  const report = {
    schema: 'vent-recruitability-phenotype-challenge/v1',
    purpose:
      'engineering identification challenge demonstrating recruitability as an axis independent of Berlin severity',
    clinicalUse: false,
    challengeStatus:
      'supra-routine synthetic engineering stress test; not a PEEP recommendation or recruitment protocol',
    challenge: CHALLENGE,
    checks,
    gatePassed: Object.values(checks).every(Boolean),
    results,
    evidenceBoundary: {
      statement:
        'ARDS opening pressures and potential recruitability are heterogeneous; exact phenotype anchors in this simulator are synthetic engineering representatives rather than clinical thresholds.',
    },
  };

  const outDir = path.resolve(__dirname, '../benchmark-results');
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(
    outDir, 'recruitability-phenotype-challenge.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');

  console.log(JSON.stringify({
    out,
    gatePassed: report.gatePassed,
    checks,
    results,
  }, null, 2));

  if (!report.gatePassed) process.exitCode = 1;
}

if (require.main === module) main();
