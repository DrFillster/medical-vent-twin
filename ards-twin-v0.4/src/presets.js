// presets.js — Four ARDS phenotypes.
// Derived from the rc1 reference model parameters for the elastic law
//   V(P, r) = c*K*(1 − exp(−(P − AOP)/K))
// where (c, K) per compartment is
//   c_N = fN × C0,  K_N = 30 cmH2O
//   c_R = fR × r × C0,  K_R = 22 cmH2O
//   c_C = fC × C0,  K_C (stiff chosen)
//
// In the dynamic engine, the contract fields capacity (= cK) and
// elasticScale (= K) are filled in directly.
//
// v0.4.3: each preset owns initialPEEP and initialRecruitmentState.
// The initializer must not invent recruitment. If either field is missing,
// makeInitialState() will fail with an explicit error rather than guessing.

const C0 = 0.120;
const K_NORMAL = 30;
const K_RECRUITABLE = 22;
const K_CONSOLIDATED = 35;   // stiffer than normal; small contribution

function makeCompartment({ id, fraction, resistance, perfusion, deadSpace,
                           elasticScale = K_NORMAL }) {
  const c = fraction * C0;        // L/cmH2O of effective spring stiffness
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
    // v0.4.3: presets own initialPEEP and initialRecruitmentState.
    // Baseline has only normal tissue; the recruitable pool is fraction=0.
    initialPEEP: 5,
    initialRecruitmentState: { normal: 1, recruitable: 0, consolidated: 0 },
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
  return {
    // v0.4.3: injury presets have a recruitable pool.
    // initialRecruitmentState is the explicit mid-state value the model
    // should start at. The dynamics will evolve it from there.
    initialPEEP: 8,
    initialRecruitmentState: { normal: 1, recruitable: 0.5, consolidated: 0 },
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
  return {
    initialPEEP: 10,
    initialRecruitmentState: { normal: 1, recruitable: 0.5, consolidated: 0 },
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
  return {
    initialPEEP: 12,
    initialRecruitmentState: { normal: 1, recruitable: 0.5, consolidated: 0 },
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
