'use strict';

// clinical_scenarios.js — evidence-backed clinical layer for virtual patients.
//
// IMPORTANT SEPARATION OF CONCERNS
// --------------------------------
// Berlin ARDS severity is an oxygenation/clinical syndrome classification.
// It is NOT a recruitability or compliance phenotype.  This module therefore
// keeps two independent axes:
//   1) clinical severity: mild / moderate / severe Berlin ARDS
//   2) mechanical construct: low / moderate / high recruitability
//
// The cohort envelope below is descriptive, not a treatment target and not a
// claim that an individual patient should have the cohort median values.
// Browser gas exchange in v0.4.5 is not validated for clinical use, so P/F and
// PaCO2 values are exposed as calibration targets/metadata only.

const { PRESETS } = require('./presets.js');

const SOURCE_CHARDS = Object.freeze({
  id: 'CHARDS-2020',
  citation: 'Huang X et al. Critical Care. 2020;24:515.',
  doi: '10.1186/s13054-020-03112-0',
  role: 'Observed ventilator/mechanics and gas-exchange envelope by Berlin severity.',
});

const SOURCE_BERLIN = Object.freeze({
  id: 'BERLIN-2012',
  citation: 'ARDS Definition Task Force. JAMA. 2012;307:2526-2533.',
  doi: '10.1001/jama.2012.5669',
  role: 'Clinical severity thresholds and syndrome definition.',
});

const SOURCE_LUNG_SAFE = Object.freeze({
  id: 'LUNG-SAFE-2016',
  citation: 'Bellani G et al. JAMA. 2016;315:788-800.',
  doi: '10.1001/jama.2016.0291',
  role: 'External real-world ARDS epidemiology and ventilation benchmark.',
});

const SOURCE_CHEN_RI = Object.freeze({
  id: 'CHEN-RI-2020',
  citation: 'Chen L et al. American Journal of Respiratory and Critical Care Medicine. 2020.',
  role: 'Recruitment-to-inflation physiology demonstrating recruitability heterogeneity.',
});

function metric(median, q1, q3, unit) {
  return Object.freeze({ median, iqr: Object.freeze([q1, q3]), unit });
}

// Observed day-1 invasive-ventilation values from CHARDS Table 3.
// These are deliberately retained as medians/IQRs rather than converted into
// synthetic distributions.  Future patient generation should be calibrated
// against patient-level or otherwise justified distributional data.
const BERLIN_COHORT_ENVELOPES = Object.freeze({
  mild: Object.freeze({
    berlin: Object.freeze({ pfLowerExclusive: 200, pfUpperInclusive: 300, minPeepCmH2O: 5 }),
    observed: Object.freeze({
      pfRatio: metric(227, 206, 270, 'mmHg'),
      peep: metric(7, 5, 8, 'cmH2O'),
      vtPerPbw: metric(7.0, 6.6, 7.7, 'mL/kg PBW'),
      plateauPressure: metric(20, 15, 23, 'cmH2O'),
      drivingPressure: metric(14, 10, 15, 'cmH2O'),
      compliance: metric(36.4, 30.7, 43.0, 'mL/cmH2O'),
      airwayResistance: metric(12.0, 9.7, 17.0, 'cmH2O/L/s'),
      paco2: metric(36.2, 29.6, 39.0, 'mmHg'),
    }),
  }),
  moderate: Object.freeze({
    berlin: Object.freeze({ pfLowerExclusive: 100, pfUpperInclusive: 200, minPeepCmH2O: 5 }),
    observed: Object.freeze({
      pfRatio: metric(142, 115, 166, 'mmHg'),
      peep: metric(8, 6, 10, 'cmH2O'),
      vtPerPbw: metric(6.8, 5.9, 8.0, 'mL/kg PBW'),
      plateauPressure: metric(20, 15, 25, 'cmH2O'),
      drivingPressure: metric(13, 8, 16, 'cmH2O'),
      compliance: metric(36.4, 24.0, 52.0, 'mL/cmH2O'),
      airwayResistance: metric(11.0, 7.8, 19.0, 'cmH2O/L/s'),
      paco2: metric(35.9, 31.0, 41.5, 'mmHg'),
    }),
  }),
  severe: Object.freeze({
    berlin: Object.freeze({ pfLowerExclusive: null, pfUpperInclusive: 100, minPeepCmH2O: 5 }),
    observed: Object.freeze({
      pfRatio: metric(78, 59, 96, 'mmHg'),
      peep: metric(10, 6, 12, 'cmH2O'),
      vtPerPbw: metric(6.8, 5.8, 7.9, 'mL/kg PBW'),
      plateauPressure: metric(22, 18, 27, 'cmH2O'),
      drivingPressure: metric(12, 8, 17, 'cmH2O'),
      compliance: metric(32.0, 25.0, 42.0, 'mL/cmH2O'),
      airwayResistance: metric(12.0, 8.0, 18.0, 'cmH2O/L/s'),
      paco2: metric(37.2, 31.8, 45.2, 'mmHg'),
    }),
  }),
});

const RECRUITABILITY_PRESETS = Object.freeze({
  low: 'phenotype_low_recruitability',
  moderate: 'phenotype_moderate_recruitability',
  high: 'phenotype_high_recruitability',
});

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

/**
 * Direct Berlin oxygenation category lookup.
 * Returns null when the oxygenation criterion is not met or PEEP is <5.
 * This function intentionally does not attempt to establish the full ARDS
 * diagnosis (timing, imaging, and edema-origin criteria remain clinical data).
 */
function classifyBerlinOxygenation({ pfRatio, peepCmH2O }) {
  if (typeof pfRatio !== 'number' || !Number.isFinite(pfRatio) || pfRatio <= 0) {
    throw new Error('pfRatio must be a finite positive number');
  }
  if (typeof peepCmH2O !== 'number' || !Number.isFinite(peepCmH2O) || peepCmH2O < 0) {
    throw new Error('peepCmH2O must be a finite non-negative number');
  }
  if (peepCmH2O < 5 || pfRatio > 300) return null;
  if (pfRatio <= 100) return 'severe';
  if (pfRatio <= 200) return 'moderate';
  return 'mild';
}

/**
 * Build a deterministic virtual-patient descriptor.
 *
 * This does NOT claim patient-specific digital-twin validity.  It combines an
 * evidence-backed clinical envelope with an independently selected mechanical
 * construct, preserving the physiologic heterogeneity needed for teaching.
 */
function makeBerlinVirtualPatient({
  severity,
  recruitability = 'moderate',
  id,
  etiology = 'pneumonia',
} = {}) {
  if (!Object.prototype.hasOwnProperty.call(BERLIN_COHORT_ENVELOPES, severity)) {
    throw new Error(`unknown Berlin severity: ${severity}`);
  }
  if (!Object.prototype.hasOwnProperty.call(RECRUITABILITY_PRESETS, recruitability)) {
    throw new Error(`unknown recruitability phenotype: ${recruitability}`);
  }

  const presetId = RECRUITABILITY_PRESETS[recruitability];
  const params = PRESETS[presetId]();
  const envelope = BERLIN_COHORT_ENVELOPES[severity];
  const caseId = id || `berlin-${severity}-${recruitability}`;

  return deepFreeze({
    schemaVersion: '0.5.0-alpha.1',
    id: caseId,
    kind: 'cohort-calibrated-virtual-patient',
    label: `${severity[0].toUpperCase()}${severity.slice(1)} Berlin ARDS / ${recruitability} recruitability`,
    clinical: {
      syndrome: 'ARDS',
      definition: 'Berlin 2012',
      severity,
      etiology,
      cohortEnvelope: deepClone(envelope),
      diagnosisCompleteness: {
        oxygenationCriterion: 'represented',
        timingCriterion: 'scenario-author must supply',
        bilateralOpacitiesCriterion: 'scenario-author must supply',
        edemaOriginCriterion: 'scenario-author must supply',
      },
    },
    mechanics: {
      recruitability,
      presetId,
      params,
      calibrationStatus: 'mechanistic construct; not fitted to Berlin grade',
    },
    initialization: {
      initialPeepCmH2O: envelope.observed.peep.median,
      initialRecruitmentState: null,
      requiresExplicitRecruitmentHistory: true,
      note: 'Do not guess recruitment from Berlin severity. Supply measured/defined history before simulation.',
    },
    gasExchange: {
      browserModelStatus: 'not clinically validated',
      calibrationTarget: {
        pfRatio: deepClone(envelope.observed.pfRatio),
        paco2: deepClone(envelope.observed.paco2),
      },
      useForClinicalScoring: false,
    },
    provenance: [SOURCE_BERLIN, SOURCE_CHARDS, SOURCE_LUNG_SAFE, SOURCE_CHEN_RI],
  });
}

function listBerlinVirtualPatientMatrix() {
  const rows = [];
  for (const severity of Object.keys(BERLIN_COHORT_ENVELOPES)) {
    for (const recruitability of Object.keys(RECRUITABILITY_PRESETS)) {
      rows.push(makeBerlinVirtualPatient({ severity, recruitability }));
    }
  }
  return Object.freeze(rows);
}

module.exports = {
  BERLIN_COHORT_ENVELOPES,
  RECRUITABILITY_PRESETS,
  classifyBerlinOxygenation,
  makeBerlinVirtualPatient,
  listBerlinVirtualPatientMatrix,
};
