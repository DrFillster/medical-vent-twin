/*
 app.js — Browser UI for lung_reference-style three-compartment lung model.

 Model lives in lung.js (loaded as a classic script that attaches
 window.LungRef). This file only:
   (1) reads configuration inputs,
   (2) builds Lung / Vent / Gas / history,
   (3) computes evaluate / ri / peep_trial,
   (4) formats results.

 The displayed values are model outputs. They are not clinical recommendations
 and the model has not been patient-validated. Layout intentionally exposes
 model inputs and a visible signed R/I so that negative or invalid results
 cannot be silently hidden (per the handoff brief).
*/
const L = window.LungRef;

function fmt(n, p = 4) {
  if (n === null || n === undefined) return "null";
  if (typeof n === "boolean") return n ? "true" : "false";
  if (Number.isNaN(n)) return "NaN";
  if (!Number.isFinite(n)) return n > 0 ? "+inf" : "-inf";
  return n.toFixed(p);
}

function readInputs() {
  const f = (id) => parseFloat(document.getElementById(id).value);
  const tissue = [f("fN"), f("fR"), f("fC")];
  const perfusion = [f("qN"), f("qR"), f("qC")];
  const lung = new L.Lung({ tissue, perfusion, resistance: f("resistance"),
                             aop: f("aop") });
  const vent = new L.Vent({ peep: f("peep"), vt: f("vt"), rr: f("rr"),
                            fio2: f("fio2"), flow: f("flow"), pbw: f("pbw") });
  const gas = new L.Gas({ hb: f("hb"), svo2: f("svo2"),
                          dead_fraction: f("dead_fraction"),
                          vco2: f("vco2"), bicarbonate: f("bicarbonate"),
                          p50: f("p50") });
  const histTxt = document.getElementById("history").value.trim();
  const history = histTxt.length ? histTxt.split(/[,\s]+/).map(parseFloat)
                                  : null;
  return { lung, vent, gas, history };
}

function safe(fn, fallback) {
  try { return fn(); }
  catch (e) { return { _error: e.message, ...fallback }; }
}

function compute() {
  document.getElementById("error").textContent = "";
  let cfg;
  try { cfg = readInputs(); }
  catch (e) {
    document.getElementById("error").textContent =
      "Input error: " + e.message;
    return;
  }
  const { lung, vent, gas, history } = cfg;

  const out = safe(() => L.evaluate(lung, vent, gas, history), {
    _error: "evaluate failed"
  });
  const ri = safe(() => L.riAnalogue(lung, vent.cfg.vt),
                  { valid: false, _error: "ri failed" });
  const trial = safe(() => L.peepTrial(lung, vent),
                     { rows: [], max_crs_peeps: [], boundary: null,
                       _error: "peep_trial failed" });

  document.getElementById("mech").textContent = formatMech(out);
  document.getElementById("gas").textContent = formatGas(out);
  document.getElementById("ri").textContent = formatRi(ri);
  document.getElementById("trial").textContent = formatTrial(trial);

  if (out._error) document.getElementById("error").textContent =
    "evaluate error: " + out._error;
}

function formatMech(o) {
  if (o._error) return "error: " + o._error;
  return [
    "PEEP            : " + fmt(o.peep, 1) + " cmH2O",
    "Pplat           : " + fmt(o.pplat, 2) + " cmH2O",
    "Ppeak           : " + fmt(o.ppeak, 2) + " cmH2O  (Pplat + R*Q)",
    "Driving press   : " + fmt(o.driving_pressure, 2) + " cmH2O",
    "Crs tidal       : " + fmt(o.crs_tidal_ml_cmH2O, 2) + " mL/cmH2O",
    "Crs tangent     : " + fmt(o.crs_tangent_ml_cmH2O, 2) + " mL/cmH2O",
    "EELV above ref  : " + fmt(o.elastic_eelv_above_reference_L, 4) + " L",
    "Open fraction   : " + fmt(o.open_fraction, 4),
    "Vt              : " + fmt(o.vt_L * 1000, 0) + " mL  ("
                       + fmt(o.vt_ml_kg, 2) + " mL/kg PBW)",
    "MP (integral)   : " + fmt(o.mp_integral_J_min, 2) + " J/min",
    "MP (linear est) : " + fmt(o.mp_linear_estimate_J_min, 2) + " J/min"
  ].join("\n");
}

function formatGas(o) {
  if (o._error) return "error: " + o._error;
  return [
    "Alveolar vent   : " + fmt(o.alveolar_ventilation_L_min, 3) + " L/min",
    "PaCO2           : " + fmt(o.paco2, 2) + " mmHg",
    "pH (fixed bicarb): " + fmt(o.ph_fixed_bicarbonate, 3),
    "PAO2            : " + fmt(o.alveolar_po2, 1) + " mmHg",
    "PaO2            : " + fmt(o.pao2, 2) + " mmHg",
    "P/F             : " + fmt(o.pf, 1) + " mmHg",
    "SaO2            : " + fmt(o.sao2, 4) + " (computed; not SpO2)",
    "Effective shunt : " + fmt(o.effective_shunt, 4),
    "CcO2 / CvO2 / CaO2 (mL/dL): "
       + fmt(o.cc_o2, 2) + " / " + fmt(o.cv_o2, 2) + " / " + fmt(o.ca_o2, 2)
  ].join("\n");
}

function formatRi(ri) {
  if (!ri.valid) return "INVALID (" + (ri.reason || ri._error || "unknown") + ")";
  return [
    "valid           : true",
    "deltaEELV_model : " + fmt(ri.delta_eelv_L, 5) + " L",
    "expected inflate: " + fmt(ri.expected_inflation_L, 5) + " L",
    "excess (signed) : " + fmt(ri.excess_volume_signed_L, 5) + " L",
    "R/I signed      : " + fmt(ri.ri_signed, 4)
                  + "    (decisive-negative values are preserved, NOT clipped)",
    "effective_low   : " + fmt(ri.effective_low, 1) + " cmH2O",
    "deltaP_eff      : " + fmt(ri.delta_p, 1) + " cmH2O",
    "C_low tidal     : " + fmt(ri.clow_tidal_ml_cmH2O, 2) + " mL/cmH2O",
    "model recruit V : " + fmt(ri.model_recruitment_volume_L, 5) + " L",
    "model inflate V : " + fmt(ri.nonlinear_inflation_volume_L, 5) + " L",
    "recruit comp.   : " + fmt(ri.recruitment_component, 4),
    "nonlinear bias  : " + fmt(ri.nonlinear_baseline_component, 4),
    "high_open / low_open : " + fmt(ri.high_open, 4)
                          + " / " + fmt(ri.low_open, 4)
  ].join("\n");
}

function formatTrial(t) {
  if (t._error) return "trial failed: " + t._error;
  const head = "step  peep  Pplat   Crs_tidal   valid";
  const rows = t.rows.map(r =>
    (r.valid ? "  ok" : "FAIL")
    + "   " + (r.crs_tidal_ml_cmH2O ?? "-").toString().padStart(6)
    + "    " + String(r.peep).padStart(4)
    + "    " + (r.pplat ?? "-").toString().padStart(6)
    + "   "
  ).join("\n");
  return [
    "label           : " + t.label,
    "max_crs_peeps   : " + JSON.stringify(t.max_crs_peeps),
    "boundary flag   : " + t.boundary
                  + "  (true means max is at the sweep edge; not a PEEP recommendation)",
    "--- rows ---",
    head,
    rows
  ].join("\n");
}

window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("compute").addEventListener("click", compute);
  document.getElementById("resetHistory")
          .addEventListener("click", () => {
    document.getElementById("history").value = "30";
  });
  compute();
});
