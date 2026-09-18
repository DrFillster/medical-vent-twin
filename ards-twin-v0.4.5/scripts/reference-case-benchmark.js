'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { getBerlinCase } = require('../src/berlin_case_catalog.js');
const { Simulation, VcAcController } = require('../src/simulation.js');
const { makePatientParams } = require('../src/contracts.js');

const CASE_ID = 'berlin-moderate-moderate-aspiration';
const clinicalCase = getBerlinCase(CASE_ID);

// Explicit engineering assumptions only. These are not patient data and are
// not derived from PBW. The purpose is to exercise mechanics reproducibly.
const assumptions = Object.freeze({
  ventilation: Object.freeze({
    mode: 'VC_AC',
    fio2: 0.60,
    peepCmH2O: 8,
    rrPerMin: 20,
    vtL: 0.42,
    inspiratoryFlowLps: 0.70,
    inspiratoryPauseSec: 0.20,
  }),
  initialRecruitmentState: Object.freeze({
    normal: 1,
    recruitable: 0.35,
    consolidated: 0,
  }),
  dtSec: 0.002,
});

const params = makePatientParams(clinicalCase.phenotype.mechanicsParams);
const controller = new VcAcController({
  fio2: assumptions.ventilation.fio2,
  peep: assumptions.ventilation.peepCmH2O,
  rr: assumptions.ventilation.rrPerMin,
  vt: assumptions.ventilation.vtL,
  inspiratoryFlow: assumptions.ventilation.inspiratoryFlowLps,
  inspiratoryPause: assumptions.ventilation.inspiratoryPauseSec,
});
const sim = new Simulation({
  params,
  controller,
  dt: assumptions.dtSec,
  trackGas: false,
  initialPEEP: assumptions.ventilation.peepCmH2O,
  initialRecruitmentState: assumptions.initialRecruitmentState,
});

// Establish a short deterministic mechanical state before explicit holds.
sim.runFor(12);
sim.requestInspiratoryHold(0.5);
sim.runFor(5);
sim.requestExpiratoryHold(0.5);
sim.runFor(5);

const measurements = sim.measurementSummary();
const report = {
  schema: 'vent-reference-case-engineering-benchmark/v1',
  caseId: CASE_ID,
  status: 'engineering-comparison-not-clinical-validation',
  assumptions,
  measurements,
  cohortEnvelope: clinicalCase.calibrationTargets.mechanics,
  caveats: [
    'Absolute VT and starting recruitment are explicit synthetic engineering assumptions.',
    'No browser gas-exchange output is used.',
    'Cohort medians/IQRs are descriptive envelopes, not individual targets.',
    'Recruitability phenotype is not a clinical R/I classification.',
  ],
};

const outDir = path.resolve(__dirname, '../benchmark-results');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'reference-case-mechanics.json');
fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
