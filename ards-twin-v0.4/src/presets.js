// presets.js — Four ARDS phenotypes (mechanics only).
//
// v0.4.4 separation of concerns:
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
                           elasticScale = K_NORMAL }) {
  const c = fraction * C0;        // L/cmH2O effective spring stiffness
  return {
    id, fraction,
    resistance,
    capacity: c * elasticScale,    // saturation asymptote L
    elasticScale,
    perfusionFraction: perfusion,
    deadSpaceFraction: deadSpace,
  };
}

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

function presetInjuryA() {
  // Mild ARDS: small recruitable pool, modest AOP shift.
  return {
    compartments: [
      makeCompartment({ id: 'normal', fraction: 0.65, resistance: 0.7,
                       perfusion: 0.75, deadSpace: 0.40,
                       elasticScale: K_NORMAL }),
      makeCompartment({ id: 'recruitable', fraction: 0.25, resistance: 0.5,
                       perfusion: 0.18, deadSpace: 0.40,
                       elasticScale: K_RECRUITABLE }),
      makeCompartment({ id: 'consolidated', fraction: 0.10, resistance: 0.5,
                       perfusion: 0.07, deadSpace: 0.40,
                       elasticScale: K_CONSOLIDATED }),
    ],
    centralAirwayResistance: 3.0,
    airwayOpeningPressure: 2,
  };
}

function presetInjuryB() {
  // Moderate ARDS: 40% recruitable pool, AOP=4.
  return {
    compartments: [
      makeCompartment({ id: 'normal', fraction: 0.40, resistance: 0.8,
                       perfusion: 0.55, deadSpace: 0.50,
                       elasticScale: K_NORMAL }),
      makeCompartment({ id: 'recruitable', fraction: 0.40, resistance: 0.5,
                       perfusion: 0.30, deadSpace: 0.50,
                       elasticScale: K_RECRUITABLE }),
      makeCompartment({ id: 'consolidated', fraction: 0.20, resistance: 0.5,
                       perfusion: 0.15, deadSpace: 0.50,
                       elasticScale: K_CONSOLIDATED }),
    ],
    centralAirwayResistance: 3.5,
    airwayOpeningPressure: 4,
  };
}

function presetInjuryC() {
  // Severe ARDS: 50% recruitable pool, AOP=6 (worse edema/collapse).
  return {
    compartments: [
      makeCompartment({ id: 'normal', fraction: 0.20, resistance: 1.0,
                       perfusion: 0.30, deadSpace: 0.60,
                       elasticScale: K_NORMAL }),
      makeCompartment({ id: 'recruitable', fraction: 0.50, resistance: 0.5,
                       perfusion: 0.45, deadSpace: 0.60,
                       elasticScale: K_RECRUITABLE }),
      makeCompartment({ id: 'consolidated', fraction: 0.30, resistance: 0.5,
                       perfusion: 0.25, deadSpace: 0.60,
                       elasticScale: K_CONSOLIDATED }),
    ],
    centralAirwayResistance: 5.0,
    airwayOpeningPressure: 6,
  };
}

const PRESETS = Object.freeze({
  Baseline: presetBaseline,
  'Injury A': presetInjuryA,
  'Injury B': presetInjuryB,
  'Injury C': presetInjuryC,
});

module.exports = { PRESETS };
