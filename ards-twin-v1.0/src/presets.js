// presets.js — Four mechanical-construct phenotypes (mechanics only).
//
// v0.4.4.1 rename (from v0.4.4 "phenotype_low_recruitability/B/C" naming to mechanical-construct
// labels):
//
//   v0.4.4 keys           v0.4.4.1 keys
//   ---------             ------------
//   Baseline           → phenotype_baseline
//   phenotype_low_recruitability (mild)    → phenotype_low_recruitability
//   phenotype_moderate_recruitability (moderate)→ phenotype_moderate_recruitability
//   phenotype_high_recruitability (severe)  → phenotype_high_recruitability
//
// The mechanical parameters are unchanged from v0.4.4. Only the
// externally-exposed labels changed. The labels are mechanical-construct
// descriptors (recruitable pool size), NOT clinical ARDS severity grades.
//
// v0.4.4 separation of concerns (unchanged):
//
//   Phenotype owns ONLY mechanics:
//     - compartment fractions, resistances, capacities, K
//     - perfusion/deadSpace fractions
//     - central airway resistance
//     - airway opening pressure (AOP) — this is an intrinsic tissue property,
//       NOT a ventilator setting, so it stays on the phenotype
//
//   Phenotype does NOT own:
//     - initialPEEP (ventilator scenario owns this)
//     - initialRecruitmentState (no guessed fraction; either supplied by
//       caller as initialRecruitmentState, or built from an explicit
//       initializationHistory)
//
// The dynamic engine (contracts.js makeInitialState) requires the caller
// to supply either initialRecruitmentState or initializationHistory.
// If neither is given, the call fails explicitly rather than guessing.

const C0 = 0.120;
const K_NORMAL = 30;
const K_RECRUITABLE = 22;
const K_CONSOLIDATED = 35;

function makeCompartment({ id, fraction, resistance, perfusion, deadSpace,
                           elasticScale = K_NORMAL, recruitment = null }) {
  const c = fraction * C0;        // L/cmH2O effective spring stiffness
  return {
    id, fraction,
    resistance,
    capacity: c * elasticScale,    // saturation asymptote L
    elasticScale,
    perfusionFraction: perfusion,
    deadSpaceFraction: deadSpace,
    ...(recruitment ? { recruitment: { ...recruitment } } : {}),
  };
}

// Synthetic recruitment-pressure anchors for the mechanical phenotypes.
//
// These are engineering calibration anchors, not clinical treatment cutoffs
// and not Berlin-severity definitions. The recruitable-pool fraction remains
// the primary low/moderate/high construct. The pressure anchors represent a
// deliberately simplified dominant opening/closing subpopulation in a
// three-compartment model; real ARDS has a distribution of regional opening
// and closing pressures.
const RECRUITMENT_CALIBRATIONS = Object.freeze({
  low: Object.freeze({
    P_open: 30,
    P_close: 15,
    k_open: 0.02,
    k_close: 0.05,
    pressureReference: 'distending-pressure-above-AOP',
    status: 'synthetic-engineering-anchor',
    interpretation: 'sticky-atelectasis-dominant representative unit',
  }),
  moderate: Object.freeze({
    P_open: 22,
    P_close: 12,
    k_open: 0.02,
    k_close: 0.05,
    pressureReference: 'distending-pressure-above-AOP',
    status: 'synthetic-engineering-anchor',
    interpretation: 'mixed-opening-pressure representative unit',
  }),
  high: Object.freeze({
    P_open: 16,
    P_close: 10,
    k_open: 0.02,
    k_close: 0.05,
    pressureReference: 'distending-pressure-above-AOP',
    status: 'synthetic-engineering-anchor',
    interpretation: 'loose-atelectasis-dominant representative unit',
  }),
});

function presetBaseline() {
  return {
    // Baseline: healthy lung, no recruitable pool, normal AOP=0.
    compartments: [
      makeCompartment({ id: 'normal', fraction: 0.98, resistance: 0.5,
                       perfusion: 0.98, deadSpace: 0.30,
                       elasticScale: K_NORMAL }),
      makeCompartment({ id: 'recruitable', fraction: 0.00, resistance: 0.5,
                       perfusion: 0.00, deadSpace: 0.30,
                       elasticScale: K_RECRUITABLE }),
      makeCompartment({ id: 'consolidated', fraction: 0.02, resistance: 0.5,
                       perfusion: 0.02, deadSpace: 0.30,
                       elasticScale: K_CONSOLIDATED }),
    ],
    centralAirwayResistance: 2.5,
    airwayOpeningPressure: 0,
  };
}

function presetPhenotypeLowRecruitability() {
  // Mechanical construct: small recruitable pool (25%), modest AOP shift.
  return {
    compartments: [
      makeCompartment({ id: 'normal', fraction: 0.65, resistance: 0.7,
                       perfusion: 0.75, deadSpace: 0.40,
                       elasticScale: K_NORMAL }),
      makeCompartment({ id: 'recruitable', fraction: 0.25, resistance: 0.5,
                       perfusion: 0.18, deadSpace: 0.40,
                       elasticScale: K_RECRUITABLE,
                       recruitment: RECRUITMENT_CALIBRATIONS.low }),
      makeCompartment({ id: 'consolidated', fraction: 0.10, resistance: 0.5,
                       perfusion: 0.07, deadSpace: 0.40,
                       elasticScale: K_CONSOLIDATED }),
    ],
    centralAirwayResistance: 3.0,
    airwayOpeningPressure: 2,
  };
}

function presetPhenotypeModerateRecruitability() {
  // Mechanical construct: 40% recruitable pool, AOP=4.
  return {
    compartments: [
      makeCompartment({ id: 'normal', fraction: 0.40, resistance: 0.8,
                       perfusion: 0.55, deadSpace: 0.50,
                       elasticScale: K_NORMAL }),
      makeCompartment({ id: 'recruitable', fraction: 0.40, resistance: 0.5,
                       perfusion: 0.30, deadSpace: 0.50,
                       elasticScale: K_RECRUITABLE,
                       recruitment: RECRUITMENT_CALIBRATIONS.moderate }),
      makeCompartment({ id: 'consolidated', fraction: 0.20, resistance: 0.5,
                       perfusion: 0.15, deadSpace: 0.50,
                       elasticScale: K_CONSOLIDATED }),
    ],
    centralAirwayResistance: 3.5,
    airwayOpeningPressure: 4,
  };
}

function presetPhenotypeHighRecruitability() {
  // Mechanical construct: 50% recruitable pool, AOP=6.
  return {
    compartments: [
      makeCompartment({ id: 'normal', fraction: 0.20, resistance: 1.0,
                       perfusion: 0.30, deadSpace: 0.60,
                       elasticScale: K_NORMAL }),
      makeCompartment({ id: 'recruitable', fraction: 0.50, resistance: 0.5,
                       perfusion: 0.45, deadSpace: 0.60,
                       elasticScale: K_RECRUITABLE,
                       recruitment: RECRUITMENT_CALIBRATIONS.high }),
      makeCompartment({ id: 'consolidated', fraction: 0.30, resistance: 0.5,
                       perfusion: 0.25, deadSpace: 0.60,
                       elasticScale: K_CONSOLIDATED }),
    ],
    centralAirwayResistance: 5.0,
    airwayOpeningPressure: 6,
  };
}

const PRESETS = Object.freeze({
  phenotype_baseline: presetBaseline,
  phenotype_low_recruitability: presetPhenotypeLowRecruitability,
  phenotype_moderate_recruitability: presetPhenotypeModerateRecruitability,
  phenotype_high_recruitability: presetPhenotypeHighRecruitability,
});

module.exports = { PRESETS, RECRUITMENT_CALIBRATIONS };
