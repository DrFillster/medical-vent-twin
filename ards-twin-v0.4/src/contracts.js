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

function makeInitialState(params, { initialVolume = 0.5 } = {}) {
  // Distribute initialVolume by tissue fraction as a starting operating point.
  const compartments = params.compartments.map(c => ({
    id: c.id,
    volume: initialVolume * c.fraction,
    flow: 0,
    alveolarPressure: 0,
    recruitment: 0,
  }));
  return {
    t: 0,
    compartments,
    airwayPressure: params.airwayOpeningPressure,
    totalFlow: 0,
    totalVolume: initialVolume,
  };
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
