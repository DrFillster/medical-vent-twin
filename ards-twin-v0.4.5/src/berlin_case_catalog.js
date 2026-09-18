'use strict';

// berlin_case_catalog.js — explicit clinical-facing synthetic ARDS cases.
//
// These are authored virtual patients, not deidentified real patients. Cohort-
// calibrated fields are inherited from clinical_scenarios.js; etiology and case
// narrative are explicit scenario assumptions. Berlin severity and mechanical
// recruitability remain independent axes.

const { makeBerlinVirtualPatient } = require('./clinical_scenarios.js');

const CASE_AUTHORING_VERSION = '0.5.0-alpha.2';

const CASE_DESIGNS = Object.freeze([
  { severity: 'mild', recruitability: 'low',
    id: 'berlin-mild-low-focal-pneumonia', name: 'Mild ARDS — focal pneumonia / low recruitability',
    etiology: 'pneumonia', pattern: 'focal-predominant',
    narrative: 'Synthetic focal-pneumonia teaching case with mild Berlin oxygenation impairment and low recruitability.' },
  { severity: 'mild', recruitability: 'moderate',
    id: 'berlin-mild-moderate-aspiration', name: 'Mild ARDS — aspiration / intermediate recruitability',
    etiology: 'aspiration', pattern: 'dependent-predominant',
    narrative: 'Synthetic aspiration teaching case with mild Berlin oxygenation impairment and intermediate recruitability.' },
  { severity: 'mild', recruitability: 'high',
    id: 'berlin-mild-high-extrapulmonary', name: 'Mild ARDS — extrapulmonary inflammation / high recruitability',
    etiology: 'extrapulmonary-inflammatory', pattern: 'diffuse',
    narrative: 'Synthetic extrapulmonary inflammatory teaching case with mild Berlin oxygenation impairment and high recruitability.' },

  { severity: 'moderate', recruitability: 'low',
    id: 'berlin-moderate-low-focal-pneumonia', name: 'Moderate ARDS — focal pneumonia / low recruitability',
    etiology: 'pneumonia', pattern: 'focal-predominant',
    narrative: 'Synthetic focal-pneumonia teaching case with moderate Berlin oxygenation impairment and low recruitability.' },
  { severity: 'moderate', recruitability: 'moderate',
    id: 'berlin-moderate-moderate-aspiration', name: 'Moderate ARDS — aspiration / intermediate recruitability',
    etiology: 'aspiration', pattern: 'dependent-predominant',
    narrative: 'Synthetic aspiration teaching case with moderate Berlin oxygenation impairment and intermediate recruitability.' },
  { severity: 'moderate', recruitability: 'high',
    id: 'berlin-moderate-high-sepsis', name: 'Moderate ARDS — extrapulmonary sepsis / high recruitability',
    etiology: 'extrapulmonary-sepsis', pattern: 'diffuse',
    narrative: 'Synthetic extrapulmonary-sepsis teaching case with moderate Berlin oxygenation impairment and high recruitability.' },

  { severity: 'severe', recruitability: 'low',
    id: 'berlin-severe-low-focal-pneumonia', name: 'Severe ARDS — focal pneumonia / low recruitability',
    etiology: 'pneumonia', pattern: 'focal-predominant',
    narrative: 'Synthetic severe Berlin ARDS teaching case designed to preserve the possibility of relatively recruitability-poor focal disease.' },
  { severity: 'severe', recruitability: 'moderate',
    id: 'berlin-severe-moderate-aspiration', name: 'Severe ARDS — aspiration / intermediate recruitability',
    etiology: 'aspiration', pattern: 'dependent-predominant',
    narrative: 'Synthetic severe Berlin ARDS teaching case with an intermediate recruitability construct.' },
  { severity: 'severe', recruitability: 'high',
    id: 'berlin-severe-high-diffuse-inflammatory', name: 'Severe ARDS — diffuse inflammatory / high recruitability',
    etiology: 'diffuse-inflammatory', pattern: 'diffuse',
    narrative: 'Synthetic severe Berlin ARDS teaching case with a high-recruitability mechanical construct.' },
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function buildCase(design) {
  const base = makeBerlinVirtualPatient({
    severity: design.severity,
    recruitability: design.recruitability,
    id: design.id,
    etiology: design.etiology,
  });
  const observed = base.clinical.cohortEnvelope.observed;

  return deepFreeze({
    schemaVersion: CASE_AUTHORING_VERSION,
    id: design.id,
    name: design.name,
    synthetic: true,
    intendedUse: 'education-and-research-simulation',
    clinical: {
      syndrome: 'ARDS',
      berlinSeverity: design.severity,
      etiology: design.etiology,
      radiographicPattern: design.pattern,
      narrative: design.narrative,
      authoringStatus: 'synthetic-scenario-assumption',
      berlinCriteria: {
        timing: {
          value: 'within-1-week-of-known-insult-or-new-worsening-respiratory-symptoms',
          status: 'synthetic-authored-assumption',
        },
        chestImaging: {
          value: 'bilateral-opacities-not-fully-explained-by-effusion-collapse-or-nodules',
          status: 'synthetic-authored-assumption',
        },
        edemaOrigin: {
          value: 'respiratory-failure-not-fully-explained-by-cardiac-failure-or-fluid-overload',
          status: 'synthetic-authored-assumption',
        },
        oxygenation: {
          berlinSeverityCategory: design.severity,
          status: 'cohort-calibrated-severity-construct-not-individual-measurement',
          note: 'No individual PaO2/FiO2 value is invented for the authored case.',
        },
      },
      diagnosisCompleteness: {
        timingCriterion: 'represented-as-synthetic-authored-assumption',
        bilateralOpacitiesCriterion: 'represented-as-synthetic-authored-assumption',
        edemaOriginCriterion: 'represented-as-synthetic-authored-assumption',
        oxygenationCriterion: 'represented-as-cohort-calibrated-severity-construct',
      },
    },
    phenotype: {
      recruitability: design.recruitability,
      mechanicsPresetId: base.mechanics.presetId,
      mechanicsParams: clone(base.mechanics.params),
      status: 'mechanistic-construct-not-fitted-to-berlin-grade',
    },
    startingVentilation: {
      mode: null,
      peepCmH2O: observed.peep.median,
      fio2Fraction: null,
      respiratoryRatePerMin: null,
      tidalVolumeMlPerKgPbw: observed.vtPerPbw.median,
      tidalVolumeMl: null,
      status: 'cohort-calibrated-targets-plus-unset-case-fields',
      note: 'Patient-specific tidal volume in mL is intentionally unset until a validated PBW workflow is supplied.',
    },
    calibrationTargets: {
      oxygenation: { pfRatio: clone(observed.pfRatio) },
      ventilation: { paco2MmHg: clone(observed.paco2) },
      mechanics: {
        plateauPressureCmH2O: clone(observed.plateauPressure),
        drivingPressureCmH2O: clone(observed.drivingPressure),
        complianceMlPerCmH2O: clone(observed.compliance),
        airwayResistanceCmH2OPerLps: clone(observed.airwayResistance),
      },
      status: 'published-cohort-envelope-not-individual-patient-truth',
    },
    initialization: clone(base.initialization),
    systemicTwin: {
      provider: 'HumMod',
      status: 'mapping-pending',
      trajectoryId: null,
      modelVersion: null,
      note: 'No systemic values are invented before a verified HumMod mapping or replay trajectory is attached.',
    },
    provenance: {
      cohortSources: clone(base.provenance),
      scenarioFields: 'synthetic-authoring-assumptions',
      mechanics: 'Vent mechanistic preset; independent of Berlin severity',
      systemic: 'HumMod mapping pending',
    },
  });
}

const BERLIN_CASE_CATALOG = Object.freeze(CASE_DESIGNS.map(buildCase));

function listBerlinCases() {
  return BERLIN_CASE_CATALOG;
}

function getBerlinCase(caseId) {
  if (typeof caseId !== 'string' || !caseId) throw new Error('caseId is required');
  const found = BERLIN_CASE_CATALOG.find(item => item.id === caseId);
  if (!found) throw new Error(`unknown Berlin case: ${caseId}`);
  return found;
}

module.exports = {
  CASE_AUTHORING_VERSION,
  BERLIN_CASE_CATALOG,
  listBerlinCases,
  getBerlinCase,
};
