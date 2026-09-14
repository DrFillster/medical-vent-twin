// harness.js — Node CLI front-end for lung.js matching audit_reference.py
// parametric sweeps. Outputs JSON to stdout.

const fs = require("fs");
const path = require("path");
const M = require("./lung.js");

function parseArgs(argv) {
  const opts = {};
  for (let i = 2; i < argv.length; i += 2) {
    const k = argv[i].replace(/^--/, "");
    opts[k] = argv[i + 1];
  }
  return opts;
}

function findCase(name) {
  for (const c of M.illustrativeCases()) {
    if (c.name === name) return c;
  }
  throw new Error("Unknown case " + name);
}

function fmt(o) {
  return JSON.stringify(o, (k, v) => {
    if (typeof v === "number" && !Number.isInteger(v)) {
      return parseFloat(v.toFixed(8));
    }
    return v;
  }, 2);
}

const opts = parseArgs(process.argv);
const cname = opts.case || "Baseline";
const c = findCase(cname);
let lung = c.lung;
let vent = c.vent;
let gas = c.gas;

if (opts.aop !== undefined) {
  lung = new M.Lung({ ...lung.cfg, aop: parseFloat(opts.aop) });
}
if (opts.relays !== undefined) {
  lung = new M.Lung({ ...lung.cfg, units: parseInt(opts.relays) });
}

// Override vent params
const ventKw = { ...vent.cfg };
if (opts.vt !== undefined) ventKw.vt = parseFloat(opts.vt);
if (opts.fio2 !== undefined) ventKw.fio2 = parseFloat(opts.fio2);
if (opts.peep !== undefined) ventKw.peep = parseFloat(opts.peep);
if (opts.rr !== undefined) ventKw.rr = parseFloat(opts.rr);
vent = new M.Vent(ventKw);

// History for state, defaults to single PEEP step (current evaluate() contract).
let history = [vent.cfg.peep];
if (opts.history !== undefined) {
  // comma-separated list, e.g. "30,14"
  history = opts.history.split(",").map(parseFloat);
}

// Work-interval override (for power resolution check)
const work = opts.work !== undefined ? parseInt(opts.work) : 240;

function safe(fn, fallback) {
  try { return fn(); }
  catch (e) { return { valid: false, error: e.message, ...fallback }; }
}

const evaluate = safe(() => M.evaluate(lung, vent, gas, history), {
  pplat: null, ppeak: null, driving_pressure: null,
  crs_tidal_ml_cmH2O: null, crs_tangent_ml_cmH2O: null,
  elastic_eelv_above_reference_L: null, open_fraction: null,
  mp_integral_J_min: null, mp_linear_estimate_J_min: null, vt_ml_kg: null,
  alveolar_ventilation_L_min: null, paco2: null, ph_fixed_bicarbonate: null,
  alveolar_po2: null, pao2: null, sao2: null, pf: null,
  effective_shunt: null, cc_o2: null, cv_o2: null, ca_o2: null
});
const ri = safe(() => M.riAnalogue(lung, vt = vent.cfg.vt),
                  { valid: false, error: "ri_failed" });
const peep_trial = safe(() => M.peepTrial(lung, vent),
                        { rows: [], max_crs_peeps: [], boundary: null,
                          label: "peep_trial_failed" });

let mpIntegral = null;
if (opts.work !== undefined) {
  const history = [30, vent.cfg.peep];
  const state = M.stateAfter(lung, history);
  mpIntegral = safe(
    () => M.mechanics(lung, vent, state, work).mp_integral_J_min,
    null
  );
}

const result = {
  evaluate,
  ri,
  peep_trial,
  mp_integral_J_min: mpIntegral
};

console.log(fmt(result));
