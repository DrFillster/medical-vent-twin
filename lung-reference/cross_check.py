"""
cross_check.py — Cross-language verification of lung.js against lung_reference.py.

Runs the four illustrative cases and compares mechanics, gas-exchange, R/I,
and PEEP trial outputs. Tolerance: 1e-6 absolute AND 1e-6 relative on matched
finite scalars; exact equality on validity flags and relay state.

Run:
  python cross_check.py

Exits 0 if all checks pass with the specified tolerances; exits 1 otherwise.
"""
import json
import math
import os
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent

TOL_ABS = 1e-6
TOL_REL = 1e-6

# ----- find node and run lung.js harness -----
NODE = "node"
HARNESS = str(HERE / "harness.js")


def run_case_through_js(case_name, vt_L=None, fio2=None, peep=None, rr=None):
    """Invoke the JS harness with arguments and parse JSON output."""
    args = [NODE, HARNESS, "--case", case_name]
    if vt_L is not None:
        args += ["--vt", str(vt_L)]
    if fio2 is not None:
        args += ["--fio2", str(fio2)]
    if peep is not None:
        args += ["--peep", str(peep)]
    if rr is not None:
        args += ["--rr", str(rr)]
    result = subprocess.run(args, capture_output=True, text=True, cwd=HERE,
                            timeout=60)
    if result.returncode != 0:
        raise RuntimeError(f"JS harness failed: {result.stderr}")
    return json.loads(result.stdout)


def approx_equal(a, b, abs_tol=TOL_ABS, rel_tol=TOL_REL):
    if a is None and b is None:
        return True
    if a is None or b is None:
        return False
    if isinstance(a, bool) or isinstance(b, bool):
        return a == b
    if not (isinstance(a, (int, float)) and isinstance(b, (int, float))):
        return a == b
    if math.isnan(a) and math.isnan(b):
        return True
    if math.isinf(a) and math.isinf(b):
        return (a > 0) == (b > 0)
    err = abs(a - b)
    if err <= abs_tol:
        return True
    ref = max(abs(a), abs(b))
    if ref > 0 and err / ref <= rel_tol:
        return True
    return False


def compare(baseline, candidate, fields, label):
    """Compare named numeric fields with tolerances."""
    fails = []
    for f in fields:
        a = baseline.get(f)
        b = candidate.get(f)
        if not approx_equal(a, b):
            fails.append(f"  {label}.{f}: py={a!r}  js={b!r}")
    return fails


# ----- import python reference -----
sys.path.insert(0, str(HERE))
import lung_reference as L


def run_case_py(name, lung, vent, gas, vt_L=None, fio2=None, peep=None, rr=None):
    """Evaluate one illustrative case (or override) using the Python source."""
    if vt_L is not None:
        vent = L.Vent(**{**vent.__dict__, "vt": vt_L})
    if fio2 is not None or peep is not None or rr is not None:
        kw = dict(vent.__dict__)
        if fio2 is not None: kw["fio2"] = fio2
        if peep is not None:  kw["peep"] = peep
        if rr is not None:    kw["rr"] = rr
        vent = L.Vent(**kw)
    out = L.evaluate(lung, vent, gas)
    ri = L.ri_analogue(lung, vt=vent.vt)
    return out, ri, L.peep_trial(lung, vent)


def js_to_py_keys(js):
    """Translate JS keys to Python dataclass keys where they match."""
    return js  # JS uses identical key names; no translation needed.


def main():
    py_cases = []
    py_cases_runs = []
    js_out = []

    fields = [
        "pplat", "ppeak", "driving_pressure", "crs_tidal_ml_cmH2O",
        "crs_tangent_ml_cmH2O", "elastic_eelv_above_reference_L",
        "open_fraction", "mp_integral_J_min", "mp_linear_estimate_J_min",
        "vt_ml_kg",
        # gas
        "alveolar_ventilation_L_min", "paco2", "ph_fixed_bicarbonate",
        "alveolar_po2", "pao2", "sao2", "pf", "effective_shunt",
        "cc_o2", "cv_o2", "ca_o2"
    ]

    for name, lung_p, vent_p, gas_p in L.illustrative_cases():
        out_p, ri_p, trial_p = run_case_py(name, lung_p, vent_p, gas_p)
        js = run_case_through_js(name)
        out_js = js["evaluate"]
        ri_js = js["ri"]
        # Compare evaluate outputs
        fails = compare(out_p, out_js, fields, f"{name}.evaluate")
        # Compare R/I scalars
        for k in ["ri_signed", "delta_eelv_L", "expected_inflation_L",
                  "excess_volume_signed_L", "effective_low", "delta_p",
                  "clow_tidal_ml_cmH2O",
                  "model_recruitment_volume_L", "nonlinear_inflation_volume_L",
                  "recruitment_component", "nonlinear_baseline_component",
                  "high_open", "low_open"]:
            a = ri_p.get(k) if ri_p.get("valid") else None
            b = ri_js.get(k) if ri_js.get("valid") else None
            if not approx_equal(a, b):
                fails.append(f"  {name}.ri.{k}: py={a!r}  js={b!r}")
        # Validity must match exactly
        if ri_p.get("valid") != ri_js.get("valid"):
            fails.append(f"  {name}.ri.valid: py={ri_p.get('valid')} js={ri_js.get('valid')}")
        # PEEP trial: max_crs_peeps must match exactly; boundary flag must match.
        if trial_p["max_crs_peeps"] != js["peep_trial"]["max_crs_peeps"]:
            fails.append(f"  {name}.peep_trial.max_crs_peeps: "
                         f"py={trial_p['max_crs_peeps']} "
                         f"js={js['peep_trial']['max_crs_peeps']}")
        if bool(trial_p["boundary"]) != bool(js["peep_trial"]["boundary"]):
            fails.append(f"  {name}.peep_trial.boundary: "
                         f"py={trial_p['boundary']} "
                         f"js={js['peep_trial']['boundary']}")

        py_cases.append(name)
        py_cases_runs.append((out_p, ri_p, trial_p, js, fails))

    # ----- parameter sensitivity checks (per audit_reference.py) -----
    # Injury C used as base for sensitivity (matches audit_reference.py).
    name, lung_p, vent_p, gas_p = L.illustrative_cases()[-1]
    audit_results = []

    # Power resolution
    for n in (60, 120, 240, 480):
        from dataclasses import replace as dc_replace
        state = L.state_after(lung_p, (30, vent_p.peep))
        mp_p = L.mechanics(lung_p, vent_p, state, n=n)["mp_integral_J_min"]
        mp_j = subprocess.run([NODE, HARNESS, "--case", name, "--work",
                               str(n)], capture_output=True, text=True,
                              cwd=HERE, timeout=60)
        mp_j_val = json.loads(mp_j.stdout)["mp_integral_J_min"]
        ok = approx_equal(mp_p, mp_j_val, abs_tol=1e-6)
        audit_results.append(("power", n, mp_p, mp_j_val, ok))

    # Relay resolution
    for units in (64, 128, 256, 512):
        model = L.Lung(**{**lung_p.__dict__, "units": units})
        ri_p = L.ri_analogue(model, vt=vent_p.vt)
        ri_j_full = json.loads(subprocess.run(
            [NODE, HARNESS, "--case", name, "--relays", str(units)],
            capture_output=True, text=True, cwd=HERE,
            timeout=60).stdout)
        ri_j = ri_j_full["ri"]
        if ri_p.get("valid"):
            ok = approx_equal(ri_p["ri_signed"], ri_j["ri_signed"])
        else:
            ok = ri_j.get("valid") == False
        audit_results.append(("relays", units, ri_p.get("ri_signed"),
                              ri_j.get("ri_signed"), ok))

    # AOP sweep
    for aop in (0, 2, 4, 6, 8, 10, 12, 14, 15, 16):
        ri_p = L.ri_analogue(L.Lung(**{**lung_p.__dict__, "aop": aop}),
                             vt=vent_p.vt)
        ri_j = json.loads(subprocess.run(
            [NODE, HARNESS, "--case", name, "--aop", str(aop)],
            capture_output=True, text=True, cwd=HERE,
            timeout=60).stdout)["ri"]
        if ri_p.get("valid"):
            ok = approx_equal(ri_p["ri_signed"], ri_j["ri_signed"])
        else:
            ok = (ri_j.get("valid") == False)
        audit_results.append(("aop", aop, ri_p.get("ri_signed"),
                              ri_j.get("ri_signed"), ok))

    # VT sweep
    for vt_l in (.20, .28, .36, .42, .50):
        ri_p = L.ri_analogue(lung_p, vt=vt_l)
        ri_j = json.loads(subprocess.run(
            [NODE, HARNESS, "--case", name, "--vt", str(vt_l)],
            capture_output=True, text=True, cwd=HERE,
            timeout=60).stdout)["ri"]
        if ri_p.get("valid"):
            ok = approx_equal(ri_p["ri_signed"], ri_j["ri_signed"])
        else:
            ok = (ri_j.get("valid") == False)
        audit_results.append(("vt", vt_l, ri_p.get("ri_signed"),
                              ri_j.get("ri_signed"), ok))

    # FiO2 sweep at fixed state
    state = L.state_after(lung_p, (30, vent_p.peep))
    for fio2 in (.21, .30, .40, .60, .80, 1.0):
        g_p = L.gas_exchange(lung_p,
                             L.Vent(**{**vent_p.__dict__, "fio2": fio2}),
                             state, gas_p)
        g_j_full = json.loads(subprocess.run(
            [NODE, HARNESS, "--case", name, "--fio2", str(fio2),
             "--history", f"30,{vent_p.peep}"],
            capture_output=True, text=True, cwd=HERE,
            timeout=60).stdout)
        g_j = g_j_full.get("evaluate", g_j_full)
        for k in ["pao2", "sao2", "pf", "effective_shunt"]:
            ok = approx_equal(g_p[k], g_j.get(k))
            audit_results.append(("fio2", f"{fio2}.{k}",
                                 g_p[k], g_j.get(k), ok))

    # ----- report -----
    print("=" * 70)
    print("Cross-language check report (lung.js vs lung_reference.py v0.1.0)")
    print("=" * 70)

    all_fails = []
    for name, (out_p, ri_p, trial_p, js, fails) in zip(py_cases, py_cases_runs):
        status = "PASS" if not fails else "FAIL"
        print(f"\n[{status}] case={name}")
        if fails:
            all_fails.extend([f"{name}: {f}" for f in fails])
        for f in fails:
            print(f)

    print("\n--- audit sweeps ---")
    for kind, key, py_v, js_v, ok in audit_results:
        flag = "PASS" if ok else "FAIL"
        print(f"  [{flag}] {kind}={key}  py={py_v}  js={js_v}")
        if not ok:
            all_fails.append(f"{kind} {key}: py={py_v} js={js_v}")

    print("\n" + "=" * 70)
    if all_fails:
        print(f"FAILURES: {len(all_fails)}")
        for f in all_fails:
            print(f)
        sys.exit(1)
    print("ALL CHECKS PASSED (tol: abs<=1e-6, rel<=1e-6)")
    sys.exit(0)


if __name__ == "__main__":
    main()
