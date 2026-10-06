'use strict';

// reference_case_calibration.js
//
// Auditable calibration profile for the first executable Berlin/HumMod case.
// This module intentionally does not calculate a recruitment-to-inflation
// ratio or convert the authored Vent phenotype into a clinical recruitability
// class. Those are measurement questions, not aliases for the preset name.

const { getBerlinCase } = require('./berlin_case_catalog.js');

const REFERENCE_CASE_ID = 'berlin-moderate-moderate-aspiration';

const EVIDENCE = Object.freeze({
  berlin: Object.freeze({
    id: 'BERLIN-2012',
    citation: 'ARDS Definition Task Force. JAMA. 2012;307:2526-2533.',
    doi: '10.1001/jama.2012.5669',
    role: 'ARDS syndrome definition and oxygenation severity categories.',
  }),
  chards: Object.freeze({
    id: 'CHARDS-2020',
    citation: 'Huang X et al. Critical Care. 2020;24:515.',
    doi: '10.1186/s13054-020-03112-0',
    role: 'Observed respiratory mechanics and ventilator envelope by Berlin severity.',
  }),
  lungSafe: Object.freeze({
    id: 'LUNG-SAFE-2016',
    citation: 'Bellani G et al. JAMA. 2016;315:788-800.',
    doi: '10.1001/jama.2016.0291',
    pmid: '26903337',
    role: 'External real-world ARDS epidemiology and ventilation benchmark.',
  }),
  chenRi: Object.freeze({
    id: 'CHEN-RI-2020',
    citation: 'Chen L et al. Am J Respir Crit Care Med. 2020;201:178-187.',
    doi: '10.1164/rccm.201902-0334OC',
    pmid: '31577153',
    role: 'Bedside recruitment-to-inflation physiology and airway-opening-pressure-aware recruitability assessment.',
  }),
  guerinAirwayClosure: Object.freeze({
    id: 'GUERIN-AIRWAY-CLOSURE-2020',
    citation: 'Guerin C et al. J Appl Physiol. 2020;128:1594-1603.',
    doi: '10.1152/japplphysiol.00059.2020',
    pmid: '32352339',
    role: 'Airway closure and airway opening pressure in mechanically ventilated ARDS.',
  }),
});

function buildReferenceCaseCalibration() {
  const c = getBerlinCase(REFERENCE_CASE_ID);
  return Object.freeze({
    schema: 'vent-reference-case-calibration/v1',
    caseId: c.id,
    caseName: c.name,
    status: 'engineering-calibration-profile-not-clinical-validation',
    clinicalAxis: Object.freeze({
      berlinSeverity: c.clinical.berlinSeverity,
      source: EVIDENCE.berlin.id,
      cohortEnvelope: c.calibrationTargets,
      envelopeSource: EVIDENCE.chards.id,
      interpretation: 'Cohort envelope only; not an individual-patient target.',
    }),
    mechanicalAxis: Object.freeze({
      authoredRecruitabilityLabel: c.phenotype.recruitability,
      mechanicsPresetId: c.phenotype.mechanicsPresetId,
      status: 'Vent-mechanical-construct-not-clinical-RI-classification',
      clinicalRecruitabilityEquivalent: null,
      recruitmentToInflationRatioTarget: null,
      note: 'Do not infer R/I ratio from Berlin severity, compliance, oxygenation, etiology, or preset name.',
    }),
    airwayOpeningPressure: Object.freeze({
      modelValueCmH2O: c.phenotype.mechanicsParams.airwayOpeningPressure,
      status: 'mechanistic-preset-parameter-not-patient-measurement',
      evidenceContext: EVIDENCE.guerinAirwayClosure.id,
      note: 'AOP must be measured/derived by an explicit protocol before patient-level interpretation.',
    }),
    requiredBeforeReferenceCaseClaim: Object.freeze([
      'explicit ventilator settings and recruitment initialization',
      'hold-derived plateau and total PEEP mechanics',
      'real non-fixture HumMod trajectory from the pinned runtime',
      'comparison of simulated mechanics with the authored cohort envelope',
      'separate recruitability measurement/protocol if an R/I label is displayed',
    ]),
    prohibitedShortcuts: Object.freeze([
      'equating Berlin severity with recruitability',
      'assigning an R/I ratio from the Vent preset label',
      'treating model airway-opening pressure as a measured patient AOP',
      'presenting fixture HumMod values as physiologic validation',
    ]),
    evidence: EVIDENCE,
  });
}

module.exports = {
  REFERENCE_CASE_ID,
  EVIDENCE,
  buildReferenceCaseCalibration,
};
