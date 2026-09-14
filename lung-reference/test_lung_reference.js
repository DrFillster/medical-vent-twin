// test_lung_reference.js — JS port of the Python 24-test suite.
//
// Native unit checks, complemented by strict cross-language comparisons.

const M = require("./lung.js");

function assert(cond, msg) {
  if (!cond) throw new Error("Assertion failed: " + msg);
}

function approx(a, b, abs_tol = 1e-6, rel_tol = 1e-6) {
  if (a === null || b === null) return a === b;
  if (typeof a === "boolean" || typeof b === "boolean") return a === b;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  const err = Math.abs(a - b);
  if (err <= abs_tol) return true;
  const ref = Math.max(Math.abs(a), Math.abs(b));
  if (ref > 0 && err / ref <= rel_tol) return true;
  return false;
}

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log("ok - " + name);
  } catch (e) {
    failed++;
    console.error("FAIL - " + name + ": " + e.message);
  }
}

const setUp = () => ({
  lung: new M.Lung(),
  vent: new M.Vent(),
  gas: new M.Gas(),
  state: M.stateAfter(new M.Lung(), [30, 10])
});

test("invalid_inputs", () => {
  const bad = [
    { tissue: [0.2, 0.2, 0.2] },
    { resistance: -1 },
    { aop: NaN },
    { opening_mid: 1 },
    { units: 2 },
    { tissue: [1, 0, 0] }
  ];
  for (const kw of bad) {
    let threw = false;
    try { new M.Lung(kw); }
    catch (e) { threw = true; }
    assert(threw, "expected throw for " + JSON.stringify(kw));
  }
  for (const kw of [{ fio2: 1.1 }, { rr: 100, flow: 0.1 }, { dead_fraction: 1 }]) {
    let threw = false;
    try {
      if (kw.fio2 !== undefined) new M.Vent(kw);
      else if (kw.rr !== undefined) new M.Vent(kw);
      else if (kw.dead_fraction !== undefined) new M.Gas(kw);
    } catch (e) { threw = true; }
    assert(threw, "expected throw");
  }
});

test("pbw_protocol_coefficients", () => {
  assert(approx(M.pbwKg(152.4, "male"), 50), "male 152.4");
  assert(approx(M.pbwKg(152.4, "female"), 45.5), "female 152.4");
  assert(approx(M.pbwKg(175, "male"), 70.566), "male 175");
});

test("volume_derivative_matches_compliance", () => {
  const { lung, state } = setUp();
  for (const p of [5, 10, 20, 40]) {
    const h = 1e-4;
    const d = (M.volume(lung, state, p + h) - M.volume(lung, state, p - h)) / (2 * h);
    const c = M.tangentCompliance(lung, state, p);
    assert(approx(d, c, 1e-9, 1e-9), "derivative at " + p);
  }
});

test("integrated_compliance_matches_volume", () => {
  const { lung, state } = setUp();
  const lo = 5, hi = 30, n = 4000;
  const dp = (hi - lo) / n;
  let area = 0;
  for (let i = 0; i < n; i++) {
    area += M.tangentCompliance(lung, state, lo + (i + 0.5) * dp) * dp;
  }
  const delta = M.volume(lung, state, hi) - M.volume(lung, state, lo);
  assert(approx(area, delta, 0, 1e-7), "integrated matches volume");
});

test("inverse_and_capacity_guard", () => {
  const { lung, state } = setUp();
  for (const p of [4, 10, 20, 60]) {
    const v = M.volume(lung, state, p);
    const pp = M.pressureForVolume(lung, state, v);
    assert(approx(pp, p, 0, 1e-8), "inverse at " + p);
  }
  let threw = false;
  try { M.pressureForVolume(lung, state, 100); }
  catch (e) { threw = true; }
  assert(threw, "expected capacity guard throw");
});

test("history_and_reset", () => {
  const { lung } = setUp();
  const up = M.stateAfter(lung, [14]);
  const down = M.stateAfter(lung, [30, 14]);
  let sUp = 0, sDown = 0;
  for (const x of up) if (x) sUp++;
  for (const x of down) if (x) sDown++;
  assert(sDown > sUp, "down > up");
  const empty = M.stepPeep(lung, down, 0);
  const eEmpty = new Set(empty);
  assert(!eEmpty.has(true), "all closed after step to 0");
});

test("stiffening_at_fixed_recruitment", () => {
  const { lung, state } = setUp();
  const low = M.tangentCompliance(lung, state, 10);
  const high = M.tangentCompliance(lung, state, 30);
  assert(low > high, "stiffening");
});

test("shunt_bounds_and_recruitment_effect", () => {
  const { lung } = setUp();
  const closed = new Array(lung.cfg.units).fill(false);
  const opened = new Array(lung.cfg.units).fill(true);
  const s0 = M.effectiveShunt(lung, closed);
  const s1 = M.effectiveShunt(lung, opened);
  assert(s1 >= 0 && s0 <= 1, "in [0,1]");
  assert(s1 <= s0, "open shunt <= closed shunt");
  assert(s1 >= lung.cfg.perfusion[2], "shunt >= qc floor");
});

test("exact_p50_and_monotone_saturation", () => {
  assert(approx(M.saturation(26.8), 0.5, 1e-7), "S(26.8)=0.5");
  const values = [0, 20, 40, 80, 200, 700].map(x => M.saturation(x));
  for (let i = 1; i < values.length; i++) assert(values[i] >= values[i-1], "monotone");
  for (const v of values) assert(v >= 0 && v <= 1, "in [0,1]");
});

test("oxygen_content_balance", () => {
  const { lung, vent, state, gas } = setUp();
  const g = M.gasExchange(lung, vent, state, gas);
  const s = g.effective_shunt;
  assert(approx(g.ca_o2, (1 - s) * g.cc_o2 + s * g.cv_o2, 1e-12, 1e-12), "balance");
  assert(approx(M.oxygenContent(g.pao2, gas), g.ca_o2, 0, 1e-10), "inversion");
});

test("zero_and_total_shunt_limits", () => {
  const base = new M.Lung();
  const { vent, state, gas } = setUp();
  const clear = new M.Lung({...base.cfg, perfusion: [1, 0, 0], residual_normal: 0});
  const g0 = M.gasExchange(clear, vent, state, gas);
  assert(approx(g0.pao2, g0.alveolar_po2, 0, 1e-8), "PaO2 = PaO2_alv at zero shunt");
  const blocked = new M.Lung({...base.cfg, perfusion: [0, 0, 1]});
  const g1 = M.gasExchange(blocked, vent, state, gas);
  assert(approx(g1.sao2, gas.cfg.svo2, 0, 1e-10), "shunt=1 → SaO2 = SvO2");
});

test("more_shunt_reduces_oxygenation", () => {
  const { lung } = setUp();
  const { vent, state, gas } = setUp();
  const a = new M.Lung({...lung.cfg, perfusion: [0.9, 0, 0.1]});
  const b = new M.Lung({...lung.cfg, perfusion: [0.6, 0, 0.4]});
  const ga = M.gasExchange(a, vent, state, gas);
  const gb = M.gasExchange(b, vent, state, gas);
  assert(ga.pao2 > gb.pao2, "more shunt -> lower PaO2");
});

test("co2_alveolar_ventilation_identity", () => {
  const { lung, state, gas } = setUp();
  const vent = new M.Vent();
  const a = M.gasExchange(lung, vent, state, gas);
  const vent2 = new M.Vent({...vent.cfg, rr: 40});
  const b = M.gasExchange(lung, vent2, state, gas);
  assert(approx(a.paco2, 2 * b.paco2, 0, 1e-10), "PaCO2 ratio");
  assert(b.ph_fixed_bicarbonate > a.ph_fixed_bicarbonate, "pH rises with VA");
});

test("invalid_gas_boundary_rejected", () => {
  const { lung, state, gas } = setUp();
  const vent = new M.Vent({rr: 2, fio2: 0.21});
  let threw = false;
  try { M.gasExchange(lung, vent, state, gas); }
  catch (e) { threw = true; }
  assert(threw, "PaO2_alv < PvO2 should throw");
});

test("power_against_independent_closed_form", () => {
  const { vent, state } = setUp();
  const lung = new M.Lung({tissue: [1, 0, 0], perfusion: [1, 0, 0], aop: 0});
  const empty = new Array(lung.cfg.units).fill(false);
  const row = M.mechanics(lung, vent, empty, 480);
  const capacity = lung.cfg.c_specific * lung.cfg.k_normal;
  const v0 = capacity * (1 - Math.exp(-vent.cfg.peep / lung.cfg.k_normal));
  const v1 = v0 + vent.cfg.vt;
  // Independent primitive of P(V)=-K*log(1-V/capacity), AOP=0.
  const F = v => lung.cfg.k_normal * ((capacity-v)
    * Math.log1p(-v/capacity) - (capacity-v));
  const area = F(v1)-F(v0) + lung.cfg.resistance*vent.cfg.flow*vent.cfg.vt;
  const expected = M.J_PER_L_CMH2O * vent.cfg.rr * area;
  assert(Math.abs(row.mp_integral_J_min - expected) < 1e-5, "trapezoid matches closed form");
});

test("quadrature_convergence", () => {
  const { lung, vent, state } = setUp();
  const vals = [120, 240, 480].map(n => M.mechanics(lung, vent, state, n).mp_integral_J_min);
  assert(Math.abs(vals[2] - vals[1]) < Math.abs(vals[1] - vals[0]), "monotone convergence");
  assert(Math.abs(vals[2] - vals[1]) < 1e-4, "tight tail");
});

test("resistance_changes_peak_and_work_not_plateau", () => {
  const { lung, vent, state } = setUp();
  const a = M.mechanics(lung, vent, state);
  const b = M.mechanics(new M.Lung({...lung.cfg, resistance: 20}), vent, state);
  assert(approx(a.pplat, b.pplat), "plateau unchanged");
  assert(approx(b.ppeak - a.ppeak, 5), "peak Δ = 5");
  assert(b.mp_integral_J_min > a.mp_integral_J_min, "more work");
});

test("known_linear_ri_cases", () => {
  assert(approx(M.riFromEndpoints(0.6, 0.2, 0.04, 15, 5).ri_signed, 0, 1e-12, 1e-12), "linear=0");
  assert(approx(M.riFromEndpoints(0.8, 0.2, 0.04, 15, 5).ri_signed, 0.5, 1e-12, 1e-12), "linear=0.5");
  assert(approx(M.riFromEndpoints(1.0, 0.2, 0.04, 15, 5).ri_signed, 1.0, 1e-12, 1e-12), "linear=1.0");
});

test("signed_ri_not_clipped", () => {
  const row = M.riFromEndpoints(0.5, 0.2, 0.04, 15, 5);
  assert(approx(row.ri_signed, -0.25), "negative preserved");
});

test("aop_endpoint_and_invalid_cases", () => {
  const { lung } = setUp();
  const row = M.riAnalogue(new M.Lung({...lung.cfg, aop: 6}));
  assert(row.effective_low === 6, "effective_low");
  assert(row.delta_p === 9, "delta_p");
  for (const aop of [15, 16]) {
    const r = M.riAnalogue(new M.Lung({...lung.cfg, aop}));
    assert(!r.valid, "AOP>high invalid");
  }
});

test("ri_exact_volume_decomposition", () => {
  const { lung } = setUp();
  const row = M.riAnalogue(lung);
  assert(approx(row.delta_eelv_L,
                row.model_recruitment_volume_L + row.nonlinear_inflation_volume_L,
                0, 1e-12), "delta_eelv = recruit + inflation");
  assert(approx(row.ri_signed, row.recruitment_component + row.nonlinear_baseline_component,
                0, 1e-12), "R/I decomposes");
});

test("no_recruitable_tissue_has_zero_true_recruitment", () => {
  const lung = new M.Lung({tissue: [0.8, 0, 0.2], perfusion: [0.8, 0, 0.2]});
  const row = M.riAnalogue(lung);
  assert(approx(row.model_recruitment_volume_L, 0, 0, 1e-12), "no tissue -> no real recruitment");
});

test("peep_trial_flags_boundary_and_aop_exclusion", () => {
  const lung = new M.Lung({tissue: [1, 0, 0], perfusion: [1, 0, 0], aop: 6});
  const { vent } = setUp();
  const trial = M.peepTrial(lung, vent);
  assert(trial.boundary, "boundary=true");
  assert(JSON.stringify(trial.max_crs_peeps) === JSON.stringify([6]), "winner at 6");
  assert(!trial.rows[trial.rows.length - 1].valid, "last row invalid");
});

test("grid_never_selects_infeasible_candidate", () => {
  const { lung, vent, gas } = setUp();
  const a = M.candidateGrid(lung, vent, gas, [[10, 0.55], [20, 0.8]], 0.88, 1, 7.20);
  assert(a.status === "no_feasible_candidate", "no_feasible");
  assert(a.minimum_model_mp_candidate === null, "null candidate");
  const b = M.candidateGrid(lung, vent, gas, [[10, 0.55], [20, 0.8]], 0.5, 100, 6);
  assert(b.minimum_model_mp_candidate !== null, "feasible found");
  assert(b.minimum_model_mp_candidate.feasible, "feasible flag set");
});

console.log("---");
console.log("Tests: passed=" + passed + " failed=" + failed);
if (failed > 0) process.exit(1);
