// contracts.js — JS implementation matching the types in contracts.spec.ts.
// The .spec.ts file is the source-of-record; this file is the runtime surface.
//
// BoundaryCondition:
//   FLOW    -> ventilator pushes flow at the airway
//   PRESSURE -> ventilator sets the airway pressure target

const assertFinite = (v, name) => {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error(`${name} must be finite number, got ${v}`);
  }
};

// v0.4.3: forward elastic law helper (used by pressure-consistent init).
// Defined locally so contracts.js doesn't depend on compartments.js — keeps
// the contract surface independent of the physics module. Equivalent to
// `forwardElasticVolume` in compartments.js.
function forwardElasticVolume(pressure, cp, availability, aop = 0) {
  if (availability <= 0) return 0;
  if (pressure <= aop) return 0;
  const vmax = availability * cp.capacity;
  const p = pressure - aop;
  return vmax * (1 - Math.exp(-p / cp.elasticScale));
}

function makeBoundaryFlow({ flowLps, fio2 }) {
  assertFinite(flowLps, 'flowLps');
  assertFinite(fio2, 'fio2');
  return Object.freeze({ kind: 'FLOW', flowLps, fio2 });
}

function makeBoundaryPressure({ pressureCmH2O, fio2 }) {
  assertFinite(pressureCmH2O, 'pressureCmH2O');
  assertFinite(fio2, 'fio2');
  return Object.freeze({ kind: 'PRESSURE', pressureCmH2O, fio2 });
}

// CompartmentParams
const COMPARTMENT_IDS = Object.freeze(['normal', 'recruitable', 'consolidated']);

function makeCompartmentParams(p) {
  if (!COMPARTMENT_IDS.includes(p.id)) throw new Error(`unknown compartment id ${p.id}`);
  ['fraction', 'resistance', 'capacity', 'elasticScale',
   'perfusionFraction', 'deadSpaceFraction'].forEach(k => {
    if (typeof p[k] !== 'number' || !Number.isFinite(p[k])) {
      throw new Error(`CompartmentParams.${k} must be finite number`);
    }
  });
  if (p.fraction < 0) throw new Error('fraction < 0');
  if (p.capacity < 0) throw new Error('capacity < 0');
  // v0.4: optional recruitment-tuning fields (hysteresis thresholds + rates).
  // Default to recruitment.js defaults if unspecified.
  const reco = p.recruitment || {};
  return Object.freeze({
    id: p.id, fraction: p.fraction, resistance: p.resistance,
    capacity: p.capacity, elasticScale: p.elasticScale,
    perfusionFraction: p.perfusionFraction,
    deadSpaceFraction: p.deadSpaceFraction,
    P_open: typeof reco.P_open === 'number' ? reco.P_open : undefined,
    P_close: typeof reco.P_close === 'number' ? reco.P_close : undefined,
    k_open: typeof reco.k_open === 'number' ? reco.k_open : undefined,
    k_close: typeof reco.k_close === 'number' ? reco.k_close : undefined,
    // v0.4.2: fN_max is deprecated; the new model uses linear availability
    // scaling. Accepted for schema-compat but ignored by the new law.
    fN_max: typeof reco.fN_max === 'number' ? reco.fN_max : undefined,
  });
}

function makeCompartmentState(s) {
  ['volume', 'flow', 'alveolarPressure', 'recruitment'].forEach(k => {
    if (typeof s[k] !== 'number' || !Number.isFinite(s[k])) {
      throw new Error(`CompartmentState.${k} must be finite number`);
    }
  });
  if (s.recruitment < 0 || s.recruitment > 1) {
    throw new Error(`recruitment out of [0,1]: ${s.recruitment}`);
  }
  return Object.freeze({
    volume: s.volume, flow: s.flow,
    alveolarPressure: s.alveolarPressure, recruitment: s.recruitment,
  });
}

function makePatientParams(p) {
  if (!Array.isArray(p.compartments) || p.compartments.length !== 3) {
    throw new Error('PatientParams.compartments must be array of 3');
  }
  const compartments = p.compartments.map(makeCompartmentParams);
  const totalFrac = compartments.reduce((s, c) => s + c.fraction, 0);
  if (Math.abs(totalFrac - 1) > 1e-9) {
    throw new Error(`compartment fractions must sum to 1, got ${totalFrac}`);
  }
  const totalPerf = compartments.reduce((s, c) => s + c.perfusionFraction, 0);
  if (Math.abs(totalPerf - 1) > 1e-9) {
    throw new Error(`compartment perfusions must sum to 1, got ${totalPerf}`);
  }
  if (typeof p.centralAirwayResistance !== 'number' ||
      !Number.isFinite(p.centralAirwayResistance)) {
    throw new Error('centralAirwayResistance must be finite number');
  }
  if (typeof p.airwayOpeningPressure !== 'number' ||
      !Number.isFinite(p.airwayOpeningPressure)) {
    throw new Error('airwayOpeningPressure must be finite number');
  }
  return Object.freeze({
    compartments,
    centralAirwayResistance: p.centralAirwayResistance,
    airwayOpeningPressure: p.airwayOpeningPressure,
  });
}

function cloneState(state) {
  return {
    t: state.t,
    compartments: state.compartments.map(s => ({ ...s })),
    airwayPressure: state.airwayPressure,
    totalFlow: state.totalFlow,
    totalVolume: state.totalVolume,
  };
}

// Pressure-consistent initialization (v0.4.3).
//
// The initializer MUST NOT invent recruitment. Presets must own either:
//   - initialPEEP + initialRecruitmentState, or
//   - initializationHistory (not implemented in v0.4.3).
//
// For each compartment, the initial volume and pressure follow the
// constitutive law:
//
//   Vmax_i  = availability_i * capacity_i
//   p_el_i  = -K_i * ln(1 - V_i / Vmax_i)   for 0 <= V_i < Vmax_i
//   P_alv_i = AOP + p_el_i
//
// Lower-bound regime (PEEP <= AOP or compartment closed):
//   - V_i = 0
//   - never permit negative volume
//   - P_alv_i = AOP (do not force P_alv = PEEP, that would require V < 0)
//
// Closed-compartment invariant (Vmax = 0):
//   - V_i = 0
//   - branch conductance = 0
//   - flow = 0
function makeInitialState(params, options = {}) {
  // v0.4.4: pressure-consistent initialization. The phenotype does NOT
  // own initialPEEP or initialRecruitmentState. The caller must supply both
  // via `options`. The initializer never guesses recruitment state.
  //
  // Acceptable caller-provided recruitment values:
  //   - { normal: 1, recruitable: r, consolidated: 0 } where 0 ≤ r ≤ 1
  //     is an explicitly justified value (not 0.37 / 0.5 by convention).
  //   - For tests that exercise the lower-bound regime, `recruitable: 0`
  //     is the explicit "closed/no-recruitment" state — that is a
  //     documented initial condition, not a guess.
  //
  // If the phenotype contains `params.initialRecruitmentState` (legacy
  // caller-side convenience), we honor it but only when the caller did
  // not also supply `options.initialRecruitmentState`. We do NOT default
  // to a closed state silently.

  function pickRecState() {
    if (options.initialRecruitmentState) return options.initialRecruitmentState;
    if (params.initialRecruitmentState &&
        typeof params.initialRecruitmentState === 'object') {
      return params.initialRecruitmentState;
    }
    // Fail explicitly — never silently guess.
    throw new Error(
      'makeInitialState: initialRecruitmentState is required (caller must ' +
      'pass it via options or as part of the phenotype contract).');
  }

  function pickPEEP() {
    if (typeof options.initialPEEP === 'number') return options.initialPEEP;
    if (typeof params.initialPEEP === 'number') return params.initialPEEP;
    return null;
  }

  const peep = pickPEEP();
  if (peep === null) {
    throw new Error(
      'makeInitialState: initialPEEP is required (caller or controller must ' +
      'provide it). The initializer does not guess initial PEEP.');
  }

  const aop = params.airwayOpeningPressure;
  const recState = pickRecState();

  // Determine per-compartment availability from preset-owned recruitment.
  function availabilityFor(cp) {
    // Validate all three preset values even if some compartments are
    // structurally closed (capacity=0). Preset values must be finite
    // numbers or undefined; otherwise reject explicitly.
    function validateNumeric(name, expected) {
      if (recState[name] === undefined) return;
      if (typeof recState[name] !== 'number' || !Number.isFinite(recState[name])) {
        throw new Error(
          `makeInitialState: initialRecruitmentState.${name} must be finite number, got ${recState[name]}`);
      }
      if (expected !== undefined && recState[name] !== expected) {
        throw new Error(
          `makeInitialState: initialRecruitmentState.${name} must be ${expected} (preset said ${recState[name]})`);
      }
    }

    if (cp.id === 'normal') {
      validateNumeric('normal', 1);
      return 1.0;
    }
    if (cp.id === 'consolidated') {
      validateNumeric('consolidated', 0);
      return 0.0;
    }
    if (cp.id === 'recruitable') {
      validateNumeric('recruitable', undefined);
      return Math.max(0, Math.min(1, recState.recruitable ?? 0));
    }
    throw new Error(`unknown compartment id: ${cp.id}`);
  }

  const compartments = params.compartments.map((cp) => {
    const a = availabilityFor(cp);
    const vmax = a * cp.capacity;

    let volume;
    if (vmax <= 0) {
      volume = 0;
    } else if (peep > aop) {
      volume = forwardElasticVolume(peep, { ...cp, capacity: vmax }, a, aop);
    } else {
      volume = 0;  // lower-bound regime
    }

    if (vmax <= 0 && Math.abs(volume) > 1e-15) {
      throw new Error(
        `initial volume ${volume} > 0 in closed compartment ${cp.id} (Vmax=0)`);
    }
    if (vmax > 0 && volume >= vmax) {
      throw new Error(
        `initial volume ${volume} exceeds capacity ${vmax} for ${cp.id}`);
    }
    if (volume < 0) {
      throw new Error(
        `initial volume ${volume} is negative for ${cp.id} ` +
        `(lower-bound regime violated)`);
    }

    const alveolarPressure = (a > 0 && peep > aop) ? peep : aop;

    return {
      id: cp.id,
      volume,
      flow: 0,
      alveolarPressure,
      recruitment: a,
    };
  });

  return {
    t: 0,
    compartments,
    airwayPressure: peep,
    totalFlow: 0,
    totalVolume: compartments.reduce((s, c) => s + c.volume, 0),
  };
}

function clamp01(x) {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

module.exports = {
  COMPARTMENT_IDS,
  makeBoundaryFlow,
  makeBoundaryPressure,
  makeCompartmentParams,
  makeCompartmentState,
  makePatientParams,
  makeInitialState,
  cloneState,
};
