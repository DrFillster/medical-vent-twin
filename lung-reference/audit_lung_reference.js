// audit_lung_reference.js — JS mirror of audit_reference.py.
//
// Sweeps power resolution, relay resolution, AOP, Vt, and FiO2 (fixed state)
// on the Injury C illustrative case. Cross-checked against the Python output
// in cross_check.py.
//
// Run: node audit_lung_reference.js

const fs = require("fs");
const path = require("path");
const M = require("./lung.js");

function fmt(o) {
  return JSON.stringify(o, (k, v) =>
    typeof v === "number" && !Number.isInteger(v)
      ? parseFloat(v.toFixed(8)) : v, 2);
}

const [, , , , name] = ["x", "x", "x", "x", "Injury C"];
const cs = M.illustrativeCases().filter(c => c.name === name);
const c = cs[cs.length - 1];
let lung = c.lung;
const vent = c.vent;
const gas = c.gas;

// 1. Power resolution
const power = [];
{
  const state = M.stateAfter(lung, [30, vent.cfg.peep]);
  for (const n of [60, 120, 240, 480]) {
    power.push({
      intervals: n,
      mp: M.mechanics(lung, vent, state, n).mp_integral_J_min
    });
  }
}

// 2. Relay resolution
const resolution = [];
for (const units of [64, 128, 256, 512]) {
  const model = new M.Lung({ ...lung.cfg, units });
  resolution.push({
    relays: units,
    ri: M.riAnalogue(model, vent.cfg.vt),
    max_crs_peeps: M.peepTrial(model, vent).max_crs_peeps
  });
}

// 3. AOP sweep — AOP affects relay thresholds in this formulation
const aop = [];
for (const a of [0, 2, 4, 6, 8, 10, 12, 14, 15, 16]) {
  aop.push({ aop: a, ...M.riAnalogue(
    new M.Lung({ ...lung.cfg, aop: a }), vent.cfg.vt) });
}

// 4. Vt sweep
const vt = [];
for (const v of [0.20, 0.28, 0.36, 0.42, 0.50]) {
  vt.push({ vt_L: v, ...M.riAnalogue(lung, v) });
}

// 5. FiO2 sweep at FIXED state
const fio2 = [];
{
  const state = M.stateAfter(lung, [30, vent.cfg.peep]);
  for (const f of [0.21, 0.30, 0.40, 0.60, 0.80, 1.00]) {
    fio2.push(M.gasExchange(lung,
      new M.Vent({ ...vent.cfg, fio2: f }), state, gas));
  }
}

const result = {
  power_resolution: power,
  relay_resolution: resolution,
  aop_sensitivity: aop,
  tidal_volume_sensitivity: vt,
  fio2_sensitivity_fixed_state: fio2
};

const out = path.join(__dirname, "results", "audit.js.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, fmt(result) + "\n");
console.log("Saved", out);
