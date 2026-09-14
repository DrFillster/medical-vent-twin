/*
 lung.js — JavaScript implementation paired with lung_reference.py v0.2.0-rc1

 Equations, units, defaults, and return shapes match the Python source.
 Scope is identical: quasi-static three-compartment mechanics, lumped airway
 resistance, passive constant-flow VCV, relay-based PEEP recruitment history,
 pressure-dependent stiffening, and shunt-only gas exchange.

 No clinical or educational validation is claimed. Computational verification
 only.

 Units:
   pressure   cmH2O (airway), mmHg (gas)
   volume     L
   flow       L/s
   time       s
   compliance L/cmH2O
   Hb         g/dL
   O2 content mL/dL
*/

const VERSION = "0.2.0-rc1";

// ---- numeric helpers ----

function require(cond, msg) {
  if (!cond) throw new Error(msg);
}

function finite(...v) {
  for (const x of v) {
    require(Number.isFinite(x), "Expected finite numeric input");
  }
}

function checkedConfig(defaults, supplied) {
  require(supplied && typeof supplied === "object" && !Array.isArray(supplied),
          "Configuration must be an object");
  for (const key of Object.keys(supplied)) {
    require(Object.hasOwn(defaults, key), "Unknown configuration key: " + key);
  }
  return Object.assign({}, defaults, supplied);
}

function freezeConfig(owner, cfg) {
  for (const key of Object.keys(cfg)) {
    if (Array.isArray(cfg[key])) cfg[key] = Object.freeze([...cfg[key]]);
  }
  owner.cfg = Object.freeze(cfg);
  Object.freeze(owner);
}

// Bisection on a monotone-increasing function.
function bisectIncreasing(fn, target, lo, hi, steps = 65) {
  finite(target, lo, hi);
  require(fn(lo) <= target && target <= fn(hi), "Target not bracketed");
  let l = lo, h = hi;
  for (let i = 0; i < steps; i++) {
    const mid = 0.5 * (l + h);
    if (fn(mid) < target) {
      l = mid;
    } else {
      h = mid;
    }
  }
  return 0.5 * (l + h);
}

// ---- Lung, Vent, Gas configuration dataclasses (frozen) ----

function fractionsOk(arr) {
  require(Array.isArray(arr), "Fractions must be an array");
  finite(...arr);
  require(arr.length === 3, "Need Normal/Recruitable/Consolidated");
  for (const x of arr) require(0 <= x && x <= 1, "Invalid fraction");
  require(Math.abs(arr[0] + arr[1] + arr[2] - 1) < 1e-10, "Fractions must sum to one");
}

function Lung(cfg = {}) {
  cfg = checkedConfig({
    tissue: [0.40, 0.40, 0.20],
    perfusion: [0.55, 0.30, 0.15],
    c_specific: 0.120,
    k_normal: 30.0,
    k_recruit: 22.0,
    aop: 4.0,
    resistance: 10.0,
    opening_mid: 14.0,
    closing_mid: 6.0,
    threshold_width: 1.5,
    units: 128,
    residual_normal: 0.02,
    residual_recruit: 0.05
  }, cfg);
  fractionsOk(cfg.tissue);
  fractionsOk(cfg.perfusion);
  finite(cfg.c_specific, cfg.k_normal, cfg.k_recruit, cfg.aop,
         cfg.resistance, cfg.opening_mid, cfg.closing_mid,
         cfg.threshold_width, cfg.residual_normal, cfg.residual_recruit);
  require(cfg.c_specific > 0, "Compliance scale must be positive");
  require(Math.min(cfg.k_normal, cfg.k_recruit) > 0, "Invalid K");
  require(cfg.aop >= 0 && cfg.resistance >= 0, "Invalid AOP/R");
  require(cfg.opening_mid > cfg.closing_mid && cfg.closing_mid >= 0, "Bad hysteresis");
  require(cfg.threshold_width > 0, "Invalid threshold width");
  require(Number.isInteger(cfg.units) && cfg.units >= 8 && cfg.units <= 4096,
          "Relay resolution must be an integer from 8 to 4096");
  require(0 <= cfg.residual_normal && cfg.residual_normal <= 1, "Invalid residual shunt");
  require(0 <= cfg.residual_recruit && cfg.residual_recruit <= 1, "Invalid residual shunt");
  for (let i = 0; i < 3; i++) {
    if (cfg.tissue[i] === 0) require(cfg.perfusion[i] === 0, "Absent tissue cannot carry perfusion");
  }
  freezeConfig(this, cfg);
}

function Vent(cfg = {}) {
  cfg = checkedConfig({
    peep: 10.0,
    vt: 0.360,
    rr: 20.0,
    fio2: 0.55,
    flow: 0.50,
    pbw: 70.0
  }, cfg);
  finite(cfg.peep, cfg.vt, cfg.rr, cfg.fio2, cfg.flow, cfg.pbw);
  require(cfg.peep >= 0, "Negative PEEP");
  require(Math.min(cfg.vt, cfg.rr, cfg.flow, cfg.pbw) > 0,
          "VT/RR/flow/PBW must be positive");
  require(0.21 <= cfg.fio2 && cfg.fio2 <= 1, "FiO2 outside 0.21-1");
  require((cfg.vt / cfg.flow) < (60.0 / cfg.rr),
          "Inspiratory time leaves no expiration");
  freezeConfig(this, cfg);
}

function Gas(cfg = {}) {
  cfg = checkedConfig({
    hb: 12.0,
    svo2: 0.75,
    dead_fraction: 0.50,
    vco2: 0.200,
    bicarbonate: 24.0,
    rq: 0.8,
    barometric: 760.0,
    water_vapor: 47.0,
    p50: 26.8
  }, cfg);
  for (const k of Object.keys(cfg)) finite(cfg[k]);
  require(cfg.hb > 0 && cfg.vco2 > 0 && cfg.bicarbonate > 0 && cfg.rq > 0 && cfg.p50 > 0,
          "Invalid gas parameter");
  require(cfg.svo2 > 0 && cfg.svo2 < 1 && cfg.dead_fraction >= 0 && cfg.dead_fraction < 1,
          "Invalid SvO2 or VD/VT");
  require(cfg.barometric > cfg.water_vapor && cfg.water_vapor >= 0,
          "Invalid atmospheric pressures");
  freezeConfig(this, cfg);
}

// Devine PBW (cm and sex string per protocol).
function pbwKg(heightCm, sex) {
  finite(heightCm);
  require(heightCm >= 120 && heightCm <= 230, "Outside adult height input domain");
  require(sex === "male" || sex === "female", "Use protocol sex coefficient");
  const base = sex === "male" ? 50 : 45.5;
  return base + 0.91 * (heightCm - 152.4);
}

// ---- recruitment relay state ----

function emptyState(lung) {
  return new Array(lung.cfg.units).fill(false);
}

function checkState(lung, state) {
  require(state.length === lung.cfg.units, "State length mismatch");
  for (const x of state) require(typeof x === "boolean", "State must be boolean");
}

// Settle relays instantly at a new PEEP; no time constant.
function stepPeep(lung, state, peep) {
  checkState(lung, state);
  finite(peep);
  require(peep >= 0, "Negative PEEP");
  const p = Math.max(0.0, peep - lung.cfg.aop);
  const gap = lung.cfg.opening_mid - lung.cfg.closing_mid;
  const out = new Array(state.length);
  for (let i = 0; i < state.length; i++) {
    const u = (i + 0.5) / lung.cfg.units;
    const close = Math.max(0.0, lung.cfg.closing_mid
                            + lung.cfg.threshold_width * Math.log(u / (1 - u)));
    const opening = close + gap;
    if (p >= opening) out[i] = true;
    else if (p <= close) out[i] = false;
    else out[i] = state[i];
  }
  return out;
}

function stateAfter(lung, pressures) {
  let state = emptyState(lung);
  for (const peep of pressures) state = stepPeep(lung, state, peep);
  return state;
}

function openFraction(lung, state) {
  checkState(lung, state);
  if (lung.cfg.tissue[1] === 0) return 0.0;
  let s = 0;
  for (const x of state) if (x) s++;
  return s / lung.cfg.units;
}

// (c, k) pairs for the two elastic compartments (consolidated has zero terms).
function elasticTerms(lung, state) {
  const r = openFraction(lung, state);
  return [
    [lung.cfg.tissue[0] * lung.cfg.c_specific, lung.cfg.k_normal],
    [lung.cfg.tissue[1] * r * lung.cfg.c_specific, lung.cfg.k_recruit]
  ];
}

// Elastic volume ABOVE a common reference (not total FRC).
//   V_i(p) = c_i * k_i * (-expm1(-p/k_i)),  p = max(P-AOP, 0)
function volume(lung, state, airwayPressure) {
  finite(airwayPressure);
  const p = Math.max(0.0, airwayPressure - lung.cfg.aop);
  let v = 0;
  for (const [c, k] of elasticTerms(lung, state)) {
    v += c * k * (-Math.expm1(-p / k));
  }
  return v;
}

// Right derivative of V wrt P at fixed recruitment state.
function tangentCompliance(lung, state, airwayPressure) {
  finite(airwayPressure);
  if (airwayPressure < lung.cfg.aop) return 0.0;
  const p = airwayPressure - lung.cfg.aop;
  let c = 0;
  for (const [cs, k] of elasticTerms(lung, state)) {
    c += cs * Math.exp(-p / k);
  }
  return c;
}

function pressureForVolume(lung, state, target) {
  finite(target);
  require(target >= 0, "Negative elastic volume");
  let cap = 0;
  for (const [c, k] of elasticTerms(lung, state)) cap += c * k;
  require(target < cap, "Tidal target reaches finite elastic capacity");
  return bisectIncreasing(p => volume(lung, state, p), target,
                          lung.cfg.aop, lung.cfg.aop + 1000);
}

const J_PER_L_CMH2O = 0.0980665;

// Quasi-static elastic inspiration + one lumped resistive drop.
function mechanics(lung, vent, state, n = 240, trace = false) {
  require(Number.isInteger(n) && n >= 8, "Invalid integration resolution");
  require(vent.cfg.peep >= lung.cfg.aop, "Waveform requires PEEP >= AOP");
  const baseline = volume(lung, state, vent.cfg.peep);
  const pplat = pressureForVolume(lung, state, baseline + vent.cfg.vt);
  const dp = pplat - vent.cfg.peep;
  const dv = vent.cfg.vt / n;
  let area = 0.0;
  const samples = trace ? [] : null;
  for (let i = 0; i <= n; i++) {
    const v = i * dv;
    const pel = pressureForVolume(lung, state, baseline + v);
    const paw = pel + lung.cfg.resistance * vent.cfg.flow;
    area += paw * dv * (i === 0 || i === n ? 0.5 : 1.0);
    if (trace) samples.push({
      time_s: v / vent.cfg.flow,
      tidal_volume_L: v,
      paw_cmH2O: paw
    });
  }
  const ppeak = pplat + lung.cfg.resistance * vent.cfg.flow;
  const result = {
    peep: vent.cfg.peep,
    vt_L: vent.cfg.vt,
    vt_ml_kg: 1000 * vent.cfg.vt / vent.cfg.pbw,
    pplat: pplat,
    ppeak: ppeak,
    driving_pressure: dp,
    crs_tidal_ml_cmH2O: 1000 * vent.cfg.vt / dp,
    crs_tangent_ml_cmH2O: 1000 * tangentCompliance(lung, state, vent.cfg.peep),
    elastic_eelv_above_reference_L: baseline,
    open_fraction: openFraction(lung, state),
    mp_integral_J_min: J_PER_L_CMH2O * vent.cfg.rr * area,
    mp_linear_estimate_J_min: J_PER_L_CMH2O * vent.cfg.rr
                            * vent.cfg.vt * (ppeak - 0.5 * dp)
  };
  if (trace) result.inspiratory_trace = samples;
  return result;
}

// Effective shunt from perfusion weights + open fraction + residuals.
function effectiveShunt(lung, state) {
  const r = openFraction(lung, state);
  const [qn, qr, qc] = lung.cfg.perfusion;
  return qn * lung.cfg.residual_normal
       + qr * ((1 - r) + r * lung.cfg.residual_recruit)
       + qc;
}

// Severinghaus-style saturation, normalized so S(P50)=0.5 exactly.
function _baseSaturation(po2) {
  return (Math.pow(po2, 3) + 150 * po2)
       / (Math.pow(po2, 3) + 150 * po2 + 23400);
}
const BASE_P50 = bisectIncreasing(_baseSaturation, 0.5, 0, 100);

function saturation(po2, p50 = 26.8) {
  finite(po2, p50);
  require(po2 >= 0 && p50 > 0, "Invalid PO2/P50");
  return _baseSaturation(po2 * BASE_P50 / p50);
}

function oxygenContent(po2, gas) {
  return 1.34 * gas.cfg.hb * saturation(po2, gas.cfg.p50) + 0.0031 * po2;
}

// Steady alveolar shunt-only mixing. Assumes ventilated perfusion equilibrates
// with a common alveolar PO2; residual terms are shunt equivalents, NOT
// resolved V/Q distributions.
function gasExchange(lung, vent, state, gas) {
  const va = vent.cfg.rr * vent.cfg.vt * (1 - gas.cfg.dead_fraction);
  const paco2 = 863 * gas.cfg.vco2 / va;
  const ph = 6.1 + Math.log10(gas.cfg.bicarbonate / (0.03 * paco2));
  // General alveolar gas equation, inspired CO2 assumed zero.
  const pao2Alv = ((gas.cfg.barometric - gas.cfg.water_vapor) * vent.cfg.fio2
                  - paco2 * (vent.cfg.fio2 + (1 - vent.cfg.fio2) / gas.cfg.rq));
  const pvo2 = bisectIncreasing(p => saturation(p, gas.cfg.p50),
                                gas.cfg.svo2, 0, 10000);
  require(pao2Alv >= pvo2, "Alveolar PO2 below imposed venous boundary");
  const shunt = effectiveShunt(lung, state);
  const cc = oxygenContent(pao2Alv, gas);
  const cv = oxygenContent(pvo2, gas);
  const ca = (1 - shunt) * cc + shunt * cv;
  const pao2 = bisectIncreasing(p => oxygenContent(p, gas),
                                ca, pvo2, pao2Alv);
  return {
    alveolar_ventilation_L_min: va,
    paco2: paco2,
    ph_fixed_bicarbonate: ph,
    alveolar_po2: pao2Alv,
    pao2: pao2,
    sao2: saturation(pao2, gas.cfg.p50),
    pf: pao2 / vent.cfg.fio2,
    effective_shunt: shunt,
    cc_o2: cc,
    cv_o2: cv,
    ca_o2: ca
  };
}

// Signed R/I-style endpoint index. Negative results are NEVER clipped.
function riFromEndpoints(vHigh, vLow, cLow, pHigh, pLow) {
  finite(vHigh, vLow, cLow, pHigh, pLow);
  if (pHigh <= pLow || cLow <= 0) {
    return { valid: false, reason: "Nonpositive delta P or C_low" };
  }
  const deltaV = vHigh - vLow;
  const expected = cLow * (pHigh - pLow);
  return {
    valid: true,
    delta_eelv_L: deltaV,
    expected_inflation_L: expected,
    excess_volume_signed_L: deltaV - expected,
    ri_signed: (deltaV - expected) / expected
  };
}

// Settled endpoint analogue of Chen R/I; does NOT simulate a single expired
// breath. Conditioning is a model history input at 30 cmH2O, not a clinical
// recruitment-maneuver recommendation.
function riAnalogue(lung, vt = 0.360, high = 15.0, low = 5.0, conditioning = 30.0) {
  finite(vt, high, low, conditioning);
  require(vt > 0 && 0 <= low && low < high, "Invalid R/I endpoints");
  require(conditioning >= high, "Conditioning must reach high endpoint");
  const effectiveLow = Math.max(low, lung.cfg.aop);
  if (effectiveLow >= high) {
    return { valid: false, reason: "AOP >= high PEEP" };
  }
  const sh = stateAfter(lung, [conditioning, high]);
  const sl = stepPeep(lung, sh, effectiveLow);
  const vh = volume(lung, sh, high);
  const vl = volume(lung, sl, effectiveLow);
  let plowPlateau;
  try {
    plowPlateau = pressureForVolume(lung, sl, vl + vt);
  } catch (e) {
    return { valid: false, reason: e.message };
  }
  const cLow = vt / (plowPlateau - effectiveLow);
  const out = riFromEndpoints(vh, vl, cLow, high, effectiveLow);
  if (!out.valid) return out;
  // Counterfactual: same high P with low-endpoint open state.
  const vHighLowstate = volume(lung, sl, high);
  const recruitment = vh - vHighLowstate;
  const inflation = vHighLowstate - vl;
  const expected = out.expected_inflation_L;
  Object.assign(out, {
    effective_low: effectiveLow,
    delta_p: high - effectiveLow,
    clow_tidal_ml_cmH2O: cLow * 1000,
    model_recruitment_volume_L: recruitment,
    nonlinear_inflation_volume_L: inflation,
    recruitment_component: recruitment / expected,
    nonlinear_baseline_component: inflation / expected - 1,
    high_open: openFraction(lung, sh),
    low_open: openFraction(lung, sl)
  });
  return out;
}

// Decremental compliance sweep. Default 20 → 4 in 2 cmH2O steps after 30
// cmH2O conditioning. Flags when the sampled maximum touches a boundary.
function peepTrial(lung, vent, steps = null, conditioning = 30.0) {
  if (steps === null) {
    const out = [];
    for (let p = 20; p > 3; p -= 2) out.push(p);
    steps = out;
  }
  require(steps.length > 0, "Empty PEEP sweep");
  for (let i = 0; i < steps.length - 1; i++) {
    require(steps[i] > steps[i+1], "Use strictly decremental steps");
  }
  require(conditioning >= Math.max(...steps), "Conditioning below sweep");
  let state = stateAfter(lung, [conditioning]);
  const rows = [];
  for (const peep of steps) {
    state = stepPeep(lung, state, peep);
    let row;
    try {
      row = mechanics(lung, new Vent({...vent.cfg, peep}), state);
      row.valid = true;
    } catch (e) {
      row = { peep, valid: false, reason: e.message };
    }
    rows.push(row);
  }
  const valid = rows.filter(r => r.valid);
  if (valid.length === 0) {
    return { rows, max_crs_peeps: [], boundary: null,
      label: "Sampled compliance maximum; not recommended PEEP" };
  }
  let best = -Infinity;
  for (const r of valid) best = Math.max(best, r.crs_tidal_ml_cmH2O);
  const winners = valid
    .filter(r => Math.abs(r.crs_tidal_ml_cmH2O - best) < 1e-7)
    .map(r => r.peep);
  const bounds = [Math.min(...valid.map(r => r.peep)),
                  Math.max(...valid.map(r => r.peep))];
  return {
    rows,
    max_crs_peeps: winners,
    boundary: bounds.some(b => winners.includes(b)),
    label: "Sampled compliance maximum; not recommended PEEP"
  };
}

// Default snapshot evaluates from a state settled at the current PEEP after
// starting CLOSED (no prior conditioning). Custom histories are supported.
function evaluate(lung, vent, gas, history = null) {
  const path = history === null ? [vent.cfg.peep] : history;
  require(path.length > 0 && path[path.length - 1] === vent.cfg.peep,
          "History must end at set PEEP");
  const state = stateAfter(lung, path);
  return {
    ...mechanics(lung, vent, state),
    ...gasExchange(lung, vent, state, gas)
  };
}

// Inspectable grid minimizer; NOT a clinical optimizer or ARDSNet protocol.
// Each candidate restarts from CLOSED. Infeasible/undefined points cannot win.
function candidateGrid(lung, vent, gas, pairs, minSaO2 = 0.88,
                       maxPlateau = 30.0, minPh = 7.20) {
  finite(minSaO2, maxPlateau, minPh);
  require(0 < minSaO2 && minSaO2 <= 1, "Invalid saturation constraint");
  require(maxPlateau > 0 && 0 < minPh && minPh < 14, "Invalid constraints");
  const rows = [];
  for (const [peep, fio2] of pairs) {
    let row;
    try {
      row = evaluate(lung, new Vent({...vent.cfg, peep, fio2}), gas);
      row.fio2 = fio2;
      row.feasible = (row.sao2 >= minSaO2
                      && row.pplat <= maxPlateau
                      && row.ph_fixed_bicarbonate >= minPh);
    } catch (e) {
      row = { peep, fio2, feasible: false, reason: e.message };
    }
    rows.push(row);
  }
  const feasible = rows.filter(r => r.feasible);
  let best = null;
  if (feasible.length > 0) {
    best = feasible.reduce((acc, r) =>
      (acc === null || r.mp_integral_J_min < acc.mp_integral_J_min) ? r : acc, null);
  }
  return {
    rows,
    minimum_model_mp_candidate: best,
    status: best ? "feasible" : "no_feasible_candidate"
  };
}

// Illustrative cases matching lung_reference.py (NEW assumed parameters; no
// clinical-cohort fit). Names deliberately do not assert a Berlin grade.
function illustrativeCases() {
  const data = [
    ["Baseline",  [0.98, 0.00, 0.02], [0.98, 0.00, 0.02], 0, 6,  5, 0.30, 0.480, 14, 0.30],
    ["Injury A",  [0.65, 0.25, 0.10], [0.75, 0.18, 0.07], 2, 8,  8, 0.40, 0.420, 16, 0.40],
    ["Injury B",  [0.40, 0.40, 0.20], [0.55, 0.30, 0.15], 4, 10, 10, 0.55, 0.360, 20, 0.50],
    ["Injury C",  [0.20, 0.50, 0.30], [0.30, 0.45, 0.25], 6, 14, 14, 0.80, 0.280, 26, 0.60]
  ];
  return data.map(([name, f, q, a, r, p, fi, vt, rr, dead]) => ({
    name,
    lung: new Lung({
      tissue: f, perfusion: q, aop: a, resistance: r
    }),
    vent: new Vent({
      peep: p, fio2: fi, vt: vt, rr: rr, flow: 0.50, pbw: 70.0
    }),
    gas: new Gas({ dead_fraction: dead })
  }));
}

// Expose fixed model defaults (not a cryptographic hash).
function caseSpec() {
  // Exposed for reproducibility tooling only.
  return {
    c_specific: 0.120, k_normal: 30.0, k_recruit: 22.0,
    opening_mid: 14.0, closing_mid: 6.0, threshold_width: 1.5,
    default_relays: 128, default_work_intervals: 240
  };
}

// ---- module surface ----

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    VERSION, J_PER_L_CMH2O, BASE_P50,
    Lung, Vent, Gas, pbwKg,
    emptyState, stepPeep, stateAfter, openFraction,
    elasticTerms, volume, tangentCompliance, pressureForVolume,
    mechanics, effectiveShunt, saturation, oxygenContent, gasExchange,
    riFromEndpoints, riAnalogue, peepTrial, evaluate, candidateGrid,
    illustrativeCases, caseSpec
  };
}
if (typeof window !== "undefined") {
  window.LungRef = {
    VERSION, J_PER_L_CMH2O, BASE_P50,
    Lung, Vent, Gas, pbwKg,
    emptyState, stepPeep, stateAfter, openFraction,
    elasticTerms, volume, tangentCompliance, pressureForVolume,
    mechanics, effectiveShunt, saturation, oxygenContent, gasExchange,
    riFromEndpoints, riAnalogue, peepTrial, evaluate, candidateGrid,
    illustrativeCases, caseSpec
  };
}
