// gas_exchange.js — compartmental V/Q gas exchange state (foundation only).
//
// This module defines the data structures and pure functions needed for
// FiO2-dependent oxygenation, shunt/low-VQ behavior, dead space, CO2
// production/elimination. It does NOT couple irreversibly to the
// ventilator controller — gas exchange runs as a parallel state
// evolution alongside mechanics.
//
// State per compartment:
//   { volume, recruitment, va_ratio (V/Q), po2, pco2, spo2 }
//
// Conventions:
//   po2, pco2 in mmHg; spo2 in [0, 1].
//   va_ratio = ventilation (L/s) / perfusion (L/s), normalized by the
//   compartment's perfusion fraction.
//   shunt_equivalent = 1 / (1 + va_ratio)  — high va_ratio → no shunt,
//   low va_ratio → high shunt effect.
//
// Functions:
//   makeInitialGasState(params)        — initial gas state for trace.
//   stepGasState(gas, params, comp, dt) — one step of gas evolution.
//   mixedArterialPo2(gas, params)      — perfusion-weighted PaO2.
//   shuntFraction(gas, params)         — perfusion-weighted shunt.
//
// The numerical values in the evolution are educational approximations,
// NOT validated physiology. See REVIEW_NOTES.md.

const ATMOSPHERIC_PO2 = 150;     // mmHg (FiO2=0.21 at sea level)
const HEMOGLOBIN_P50 = 26.7;     // mmHg
const HILL_N = 2.7;
const CO2_PRODUCTION_ML_PER_KG_MIN = 3.0;   // mL/kg/min (educational)
const REFERENCE_BODY_WEIGHT_KG = 70;
const STANDARD_CO2_PRODUCTION = CO2_PRODUCTION_ML_PER_KG_MIN * REFERENCE_BODY_WEIGHT_KG / 60; // mL/s

function makeInitialGasState(params, fio2 = 0.21) {
  const inspiredPo2 = (fio2 * (ATMOSPHERIC_PO2 - 47)) + 47; // simplified alveolar gas eq
  const gas = {
    fio2,
    inspiredPo2,
    compartments: params.compartments.map(c => ({
      va_ratio: c.fraction > 0 ? c.fraction / Math.max(c.perfusionFraction, 1e-6) : 0,
      po2: inspiredPo2,
      pco2: 40,
      spo2: 0.97,
    })),
  };
  return gas;
}

// Hill equation: SpO2 from PO2 (educational approximation).
function spo2FromPo2(po2) {
  if (po2 <= 0) return 0;
  const ratio = po2 / HEMOGLOBIN_P50;
  const spo2 = Math.pow(ratio, HILL_N) / (1 + Math.pow(ratio, HILL_N));
  return Math.max(0, Math.min(1, spo2));
}

function stepGasState(gas, params, compartments, dt) {
  // Simple time-evolution: each compartment's PO2 relaxes toward a
  // ventilation-perfusion-determined equilibrium. No coupling across
  // compartments at this stage — left as a P5+ extension hook.
  const next = {
    fio2: gas.fio2,
    inspiredPo2: gas.inspiredPo2,
    compartments: gas.compartments.map((g, i) => {
      const cp = params.compartments[i];
      const cs = compartments[i];
      // Ventilation proxy: |flow|, perfusion from params.
      const va_proxy = Math.abs(cs.flow) + 1e-6;
      const q_proxy = Math.max(cp.perfusionFraction, 1e-6);
      const va_ratio = va_proxy / q_proxy;
      // Alveolar PO2 equilibrium: weighted blend of inspired PO2 and
      // mixed-venous PO2 (40 mmHg) by va_ratio.
      const mixedVenousPo2 = 40;
      const alvPo2 = (gas.inspiredPo2 * va_ratio + mixedVenousPo2) / (va_ratio + 1);
      // Relaxation toward equilibrium (educational time constant).
      const tau = 4.0; // seconds
      const alpha = 1 - Math.exp(-dt / tau);
      const po2 = g.po2 + alpha * (alvPo2 - g.po2);
      // PCO2: inversely proportional to va_ratio, baseline 40 mmHg.
      const pco2 = 40 / Math.max(va_ratio, 0.01);
      return {
        va_ratio,
        po2,
        pco2: Math.max(pco2, 5),
        spo2: spo2FromPo2(po2),
      };
    }),
  };
  return next;
}

function mixedArterialPo2(gas, params) {
  // Perfusion-weighted PaO2 across compartments.
  let totalPerf = 0, weighted = 0;
  for (let i = 0; i < gas.compartments.length; i++) {
    const cp = params.compartments[i];
    const perf = cp.perfusionFraction;
    weighted += gas.compartments[i].po2 * perf;
    totalPerf += perf;
  }
  return totalPerf > 0 ? weighted / totalPerf : 0;
}

function shuntFraction(gas, params) {
  // Perfusion-weighted shunt = sum(perf * 1/(1+va_ratio)).
  let totalPerf = 0, weighted = 0;
  for (let i = 0; i < gas.compartments.length; i++) {
    const cp = params.compartments[i];
    const perf = cp.perfusionFraction;
    const va = gas.compartments[i].va_ratio;
    weighted += perf * (1 / (1 + va));
    totalPerf += perf;
  }
  return totalPerf > 0 ? weighted / totalPerf : 0;
}

function deadSpaceFraction(gas, params) {
  // V/Q ratio > 1 → dead space proxy. Perfusion-weighted dead-space.
  let totalPerf = 0, weighted = 0;
  for (let i = 0; i < gas.compartments.length; i++) {
    const cp = params.compartments[i];
    const perf = cp.perfusionFraction;
    const va = gas.compartments[i].va_ratio;
    weighted += perf * Math.max(0, (va - 1) / va);
    totalPerf += perf;
  }
  return totalPerf > 0 ? weighted / totalPerf : 0;
}

module.exports = {
  makeInitialGasState,
  stepGasState,
  mixedArterialPo2,
  shuntFraction,
  deadSpaceFraction,
  spo2FromPo2,
};
