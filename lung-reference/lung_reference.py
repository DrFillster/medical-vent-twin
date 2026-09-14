"""Auditable educational lung model, version 0.1.0 (2026-09-13).

Python 3.10+, standard library only. This is a NEW reference implementation,
not a patch or reproduction of medical-vent-twin commit b18b8a7.
Scope: quasi-static three-compartment mechanics, lumped airway resistance,
passive constant-flow VCV, discrete PEEP-history recruitment, and steady
shunt-only gas exchange. No clinical or educational validation is claimed.
Units: L, s, cmH2O; gas pressures mmHg, Hb g/dL, O2 content mL/dL.
Run: python lung_reference.py --out results
"""

from dataclasses import asdict, dataclass, replace
from pathlib import Path
import argparse
import hashlib
import json
import math
import platform

VERSION = "0.1.0"
J_PER_L_CMH2O = 0.0980665


def require(condition, message):
    if not condition:
        raise ValueError(message)


def finite(*values):
    require(all(math.isfinite(x) for x in values), "Non-finite input")


def fractions(values):
    finite(*values)
    require(len(values) == 3, "Need Normal/Recruitable/Consolidated")
    require(all(0 <= x <= 1 for x in values), "Invalid fraction")
    require(abs(sum(values) - 1) < 1e-10, "Fractions must sum to one")


def bisect_increasing(fn, target, lo, hi, steps=65):
    finite(target, lo, hi)
    require(fn(lo) <= target <= fn(hi), "Target not bracketed")
    for _ in range(steps):
        mid = (lo + hi) / 2
        if fn(mid) < target:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


@dataclass(frozen=True)
class Lung:
    # Tissue fractions weight mechanics; perfusion weights gas mixing.
    tissue: tuple = (0.40, 0.40, 0.20)
    perfusion: tuple = (0.55, 0.30, 0.15)
    c_specific: float = 0.120  # L/cmH2O for unit tissue at zero pressure
    k_normal: float = 30.0  # elastic stiffening scales, cmH2O
    k_recruit: float = 22.0
    aop: float = 4.0  # scalar effective pressure offset; not closure dynamics
    resistance: float = 10.0  # lumped cmH2O/(L/s)
    opening_mid: float = 14.0  # all relay thresholds are ABOVE AOP
    closing_mid: float = 6.0
    threshold_width: float = 1.5
    units: int = 128  # relay quadrature resolution, not anatomical alveoli
    residual_normal: float = 0.02
    residual_recruit: float = 0.05

    def __post_init__(self):
        fractions(self.tissue)
        fractions(self.perfusion)
        finite(self.c_specific, self.k_normal, self.k_recruit, self.aop,
               self.resistance, self.opening_mid, self.closing_mid,
               self.threshold_width, self.residual_normal,
               self.residual_recruit)
        require(self.c_specific > 0, "Compliance scale must be positive")
        require(min(self.k_normal, self.k_recruit) > 0, "Invalid K")
        require(self.aop >= 0 and self.resistance >= 0, "Invalid AOP/R")
        require(self.opening_mid > self.closing_mid >= 0, "Bad hysteresis")
        require(self.threshold_width > 0, "Invalid threshold width")
        require(type(self.units) is int and self.units >= 8, "Invalid units")
        require(0 <= self.residual_normal <= 1, "Invalid residual shunt")
        require(0 <= self.residual_recruit <= 1, "Invalid residual shunt")
        for f, q in zip(self.tissue, self.perfusion):
            require(f > 0 or q == 0, "Absent tissue cannot carry perfusion")


@dataclass(frozen=True)
class Vent:
    peep: float = 10.0
    vt: float = 0.360
    rr: float = 20.0
    fio2: float = 0.55
    flow: float = 0.50  # L/s; constant during inspiration
    pbw: float = 70.0

    def __post_init__(self):
        finite(self.peep, self.vt, self.rr, self.fio2, self.flow, self.pbw)
        require(self.peep >= 0, "Negative PEEP")
        require(min(self.vt, self.rr, self.flow, self.pbw) > 0,
                "VT/RR/flow/PBW must be positive")
        require(0.21 <= self.fio2 <= 1, "FiO2 outside 0.21-1")
        require(self.vt / self.flow < 60 / self.rr,
                "Inspiratory time leaves no expiration")


@dataclass(frozen=True)
class Gas:
    hb: float = 12.0
    svo2: float = 0.75  # imposed venous boundary, NOT cardiac-output model
    dead_fraction: float = 0.50  # total VD/VT, held fixed in a scenario
    vco2: float = 0.200  # L/min STPD
    bicarbonate: float = 24.0  # mmol/L, fixed buffering assumption
    rq: float = 0.8
    barometric: float = 760.0
    water_vapor: float = 47.0
    p50: float = 26.8  # mmHg, fixed; no automatic Bohr/temp/COHb shift

    def __post_init__(self):
        finite(*asdict(self).values())
        require(min(self.hb, self.vco2, self.bicarbonate, self.rq,
                    self.p50) > 0, "Invalid gas parameter")
        require(0 < self.svo2 < 1 and 0 <= self.dead_fraction < 1,
                "Invalid SvO2 or VD/VT")
        require(self.barometric > self.water_vapor >= 0,
                "Invalid atmospheric pressures")


def pbw_kg(height_cm, sex):
    finite(height_cm)
    require(120 <= height_cm <= 230, "Outside adult height input domain")
    require(sex in ("male", "female"), "Use protocol sex coefficient")
    return (50 if sex == "male" else 45.5) + 0.91 * (height_cm - 152.4)


def empty_state(lung):
    return (False,) * lung.units


def check_state(lung, state):
    require(len(state) == lung.units, "State length mismatch")
    require(all(type(x) is bool for x in state), "State must be boolean")


def step_peep(lung, state, peep):
    """Instantaneously settle relays at a new PEEP; no time constant.

    Logistically distributed thresholds, with fixed opening-closing gap.
    History is retained inside that gap. State is frozen during a breath.
    """
    check_state(lung, state)
    finite(peep)
    require(peep >= 0, "Negative PEEP")
    p = max(0.0, peep - lung.aop)
    gap = lung.opening_mid - lung.closing_mid
    result = []
    for i, previous in enumerate(state):
        u = (i + 0.5) / lung.units
        close = max(0.0, lung.closing_mid
                    + lung.threshold_width * math.log(u / (1 - u)))
        opening = close + gap
        result.append(True if p >= opening else
                      False if p <= close else previous)
    return tuple(result)


def state_after(lung, pressures):
    state = empty_state(lung)
    for peep in pressures:
        state = step_peep(lung, state, peep)
    return state


def open_fraction(lung, state):
    check_state(lung, state)
    return sum(state) / lung.units if lung.tissue[1] > 0 else 0.0


def elastic_terms(lung, state):
    r = open_fraction(lung, state)
    return ((lung.tissue[0] * lung.c_specific, lung.k_normal),
            (lung.tissue[1] * r * lung.c_specific, lung.k_recruit))


def volume(lung, state, airway_pressure):
    """Elastic volume ABOVE an arbitrary common reference; not total FRC.

    V_i = f_i*r_i*C_specific*K_i*(1-exp(-p/K_i)), p=max(P-AOP,0).
    Consolidated tissue has zero elastic volume and compliance.
    """
    finite(airway_pressure)
    p = max(0.0, airway_pressure - lung.aop)
    return sum(c * k * -math.expm1(-p / k)
               for c, k in elastic_terms(lung, state))


def tangent_compliance(lung, state, airway_pressure):
    # Right derivative at P=AOP; state MUST be held fixed.
    finite(airway_pressure)
    if airway_pressure < lung.aop:
        return 0.0
    p = airway_pressure - lung.aop
    return sum(c * math.exp(-p / k)
               for c, k in elastic_terms(lung, state))


def pressure_for_volume(lung, state, target):
    finite(target)
    require(target >= 0, "Negative elastic volume")
    cap = sum(c * k for c, k in elastic_terms(lung, state))
    require(target < cap, "Tidal target reaches finite elastic capacity")
    return bisect_increasing(lambda p: volume(lung, state, p), target,
                             lung.aop, lung.aop + 1000)


def mechanics(lung, vent, state, n=240, trace=False):
    """Quasi-static elastic inspiration plus one lumped resistive drop.

    Full expiration to set PEEP is assumed, not simulated. No parallel RC
    transients, auto-PEEP, intratidal recruitment, or spontaneous effort.
    MP integrates total inspiratory airway work relative to atmosphere.
    """
    require(type(n) is int and n >= 8, "Invalid integration resolution")
    require(vent.peep >= lung.aop, "Waveform requires PEEP >= AOP")
    baseline = volume(lung, state, vent.peep)
    pplat = pressure_for_volume(lung, state, baseline + vent.vt)
    dp = pplat - vent.peep
    dv = vent.vt / n
    samples = []
    area = 0.0
    for i in range(n + 1):
        v = i * dv
        pel = pressure_for_volume(lung, state, baseline + v)
        paw = pel + lung.resistance * vent.flow
        area += paw * dv * (0.5 if i in (0, n) else 1.0)
        if trace:
            samples.append({"time_s": v / vent.flow,
                            "tidal_volume_L": v, "paw_cmH2O": paw})
    ppeak = pplat + lung.resistance * vent.flow
    result = {"peep": vent.peep, "vt_L": vent.vt,
              "vt_ml_kg": 1000 * vent.vt / vent.pbw,
              "pplat": pplat, "ppeak": ppeak, "driving_pressure": dp,
              "crs_tidal_ml_cmH2O": 1000 * vent.vt / dp,
              "crs_tangent_ml_cmH2O": 1000 * tangent_compliance(
                  lung, state, vent.peep),
              "elastic_eelv_above_reference_L": baseline,
              "open_fraction": open_fraction(lung, state),
              "mp_integral_J_min": J_PER_L_CMH2O * vent.rr * area,
              "mp_linear_estimate_J_min": J_PER_L_CMH2O * vent.rr
                  * vent.vt * (ppeak - 0.5 * dp)}
    if trace:
        result["inspiratory_trace"] = samples
    return result


def effective_shunt(lung, state):
    r = open_fraction(lung, state)
    qn, qr, qc = lung.perfusion
    return (qn * lung.residual_normal
            + qr * ((1 - r) + r * lung.residual_recruit) + qc)


def base_saturation(po2):
    return (po2 ** 3 + 150 * po2) / (po2 ** 3 + 150 * po2 + 23400)


BASE_P50 = bisect_increasing(base_saturation, 0.5, 0, 100)


def saturation(po2, p50=26.8):
    finite(po2, p50)
    require(po2 >= 0 and p50 > 0, "Invalid PO2/P50")
    return base_saturation(po2 * BASE_P50 / p50)


def oxygen_content(po2, gas):
    return 1.34 * gas.hb * saturation(po2, gas.p50) + 0.0031 * po2


def gas_exchange(lung, vent, state, gas):
    va = vent.rr * vent.vt * (1 - gas.dead_fraction)
    paco2 = 863 * gas.vco2 / va  # VCO2 STPD, VA BTPS, both L/min
    ph = 6.1 + math.log10(gas.bicarbonate / (0.03 * paco2))
    # General alveolar gas equation, inspired CO2 assumed zero.
    pao2_alv = ((gas.barometric - gas.water_vapor) * vent.fio2
                - paco2 * (vent.fio2 + (1 - vent.fio2) / gas.rq))
    pvo2 = bisect_increasing(lambda p: saturation(p, gas.p50),
                            gas.svo2, 0, 10000)
    require(pao2_alv >= pvo2, "Alveolar PO2 below imposed venous boundary")
    shunt = effective_shunt(lung, state)
    cc = oxygen_content(pao2_alv, gas)
    cv = oxygen_content(pvo2, gas)
    ca = (1 - shunt) * cc + shunt * cv
    pao2 = bisect_increasing(lambda p: oxygen_content(p, gas),
                            ca, pvo2, pao2_alv)
    return {"alveolar_ventilation_L_min": va, "paco2": paco2,
            "ph_fixed_bicarbonate": ph, "alveolar_po2": pao2_alv,
            "pao2": pao2, "sao2": saturation(pao2, gas.p50),
            "pf": pao2 / vent.fio2, "effective_shunt": shunt,
            "cc_o2": cc, "cv_o2": cv, "ca_o2": ca}


def ri_from_endpoints(vhigh, vlow, clow, phigh, plow):
    """Signed R/I-style index; negative results are NEVER clipped."""
    finite(vhigh, vlow, clow, phigh, plow)
    if phigh <= plow or clow <= 0:
        return {"valid": False, "reason": "Nonpositive delta P or C_low"}
    delta_v = vhigh - vlow
    expected = clow * (phigh - plow)
    return {"valid": True, "delta_eelv_L": delta_v,
            "expected_inflation_L": expected,
            "excess_volume_signed_L": delta_v - expected,
            "ri_signed": (delta_v - expected) / expected}


def ri_analogue(lung, vt=0.360, high=15.0, low=5.0,
                conditioning=30.0):
    """Settled endpoint analogue; NOT a simulated single expired breath.

    Fixed conditioning -> high -> effective low, all pressures airway.
    Also expose exact model recruitment volume and nonlinear bias.
    """
    finite(vt, high, low, conditioning)
    require(vt > 0 and 0 <= low < high, "Invalid R/I endpoints")
    require(conditioning >= high, "Conditioning must reach high endpoint")
    effective_low = max(low, lung.aop)
    if effective_low >= high:
        return {"valid": False, "reason": "AOP >= high PEEP"}
    sh = state_after(lung, (conditioning, high))
    sl = step_peep(lung, sh, effective_low)
    vh = volume(lung, sh, high)
    vl = volume(lung, sl, effective_low)
    try:
        plow_plateau = pressure_for_volume(lung, sl, vl + vt)
    except ValueError as exc:
        return {"valid": False, "reason": str(exc)}
    clow = vt / (plow_plateau - effective_low)
    out = ri_from_endpoints(vh, vl, clow, high, effective_low)
    if not out["valid"]:
        return out
    # Counterfactual: same high pressure with low-endpoint open state.
    vhigh_lowstate = volume(lung, sl, high)
    recruitment = vh - vhigh_lowstate
    inflation = vhigh_lowstate - vl
    expected = out["expected_inflation_L"]
    out.update({"effective_low": effective_low,
                "delta_p": high - effective_low,
                "clow_tidal_ml_cmH2O": clow * 1000,
                "model_recruitment_volume_L": recruitment,
                "nonlinear_inflation_volume_L": inflation,
                "recruitment_component": recruitment / expected,
                "nonlinear_baseline_component": inflation / expected - 1,
                "high_open": open_fraction(lung, sh),
                "low_open": open_fraction(lung, sl)})
    return out


def peep_trial(lung, vent, steps=tuple(range(20, 3, -2)),
               conditioning=30.0):
    require(len(steps) > 0, "Empty PEEP sweep")
    require(all(a > b for a, b in zip(steps, steps[1:])),
            "Use strictly decremental steps")
    require(conditioning >= max(steps), "Conditioning below sweep")
    state = state_after(lung, (conditioning,))
    rows = []
    for peep in steps:
        state = step_peep(lung, state, peep)
        try:
            row = mechanics(lung, replace(vent, peep=peep), state)
            row["valid"] = True
        except ValueError as exc:
            row = {"peep": peep, "valid": False, "reason": str(exc)}
        rows.append(row)
    valid = [r for r in rows if r["valid"]]
    if not valid:
        return {"rows": rows, "max_crs_peeps": [], "boundary": None}
    best = max(r["crs_tidal_ml_cmH2O"] for r in valid)
    winners = [r["peep"] for r in valid
               if abs(r["crs_tidal_ml_cmH2O"] - best) < 1e-7]
    bounds = (min(r["peep"] for r in valid), max(r["peep"] for r in valid))
    return {"rows": rows, "max_crs_peeps": winners,
            "boundary": any(p in bounds for p in winners),
            "label": "Sampled compliance maximum; not recommended PEEP"}


def evaluate(lung, vent, gas, history=None):
    # Default: start with recruitable tissue closed, settle at set PEEP.
    path = (vent.peep,) if history is None else tuple(history)
    require(path and path[-1] == vent.peep, "History must end at set PEEP")
    state = state_after(lung, path)
    return {**mechanics(lung, vent, state),
            **gas_exchange(lung, vent, state, gas)}


def candidate_grid(lung, vent, gas, pairs, min_sao2=0.88,
                   max_plateau=30.0, min_ph=7.20):
    """Research grid only, not a clinical optimizer or ARDSNet protocol.

    Each candidate starts from the same CLOSED state, without a maneuver.
    Infeasible/undefined points cannot win. These limits are caller choices.
    """
    finite(min_sao2, max_plateau, min_ph)
    require(0 < min_sao2 <= 1, "Invalid saturation constraint")
    require(max_plateau > 0 and 0 < min_ph < 14, "Invalid constraints")
    rows = []
    for peep, fio2 in pairs:
        try:
            row = evaluate(lung, replace(vent, peep=peep, fio2=fio2), gas)
            row["fio2"] = fio2
            row["feasible"] = (row["sao2"] >= min_sao2
                               and row["pplat"] <= max_plateau
                               and row["ph_fixed_bicarbonate"] >= min_ph)
        except ValueError as exc:
            row = {"peep": peep, "fio2": fio2, "feasible": False,
                   "reason": str(exc)}
        rows.append(row)
    feasible = [r for r in rows if r["feasible"]]
    best = min(feasible, key=lambda r: r["mp_integral_J_min"], default=None)
    return {"rows": rows, "minimum_model_mp_candidate": best,
            "status": "feasible" if best else "no_feasible_candidate"}


def illustrative_cases():
    # NEW assumed parameters. No fit to LUNG SAFE or Chen distributions.
    # Names deliberately do not assert a Berlin grade.
    data = [
        ("Baseline", (0.98, 0.00, 0.02), (0.98, 0.00, 0.02),
         0, 6, 5, 0.30, 0.480, 14, 0.30),
        ("Injury A", (0.65, 0.25, 0.10), (0.75, 0.18, 0.07),
         2, 8, 8, 0.40, 0.420, 16, 0.40),
        ("Injury B", (0.40, 0.40, 0.20), (0.55, 0.30, 0.15),
         4, 10, 10, 0.55, 0.360, 20, 0.50),
        ("Injury C", (0.20, 0.50, 0.30), (0.30, 0.45, 0.25),
         6, 14, 14, 0.80, 0.280, 26, 0.60)]
    return [(name, Lung(tissue=f, perfusion=q, aop=a, resistance=r),
             Vent(peep=p, fio2=fi, vt=vt, rr=rr),
             Gas(dead_fraction=dead))
            for name, f, q, a, r, p, fi, vt, rr, dead in data]


def run_benchmarks():
    cases = []
    for name, lung, vent, gas in illustrative_cases():
        cases.append({"name": name, "lung": asdict(lung),
                      "vent": asdict(vent), "gas": asdict(gas),
                      "outputs": evaluate(lung, vent, gas),
                      "ri": ri_analogue(lung, vt=vent.vt),
                      "peep_trial": peep_trial(lung, vent)})
    name, lung, vent, gas = illustrative_cases()[-1]
    sensitivity = []
    # Vary recruitable MECHANICAL fraction at fixed normal fraction and
    # fixed perfusion, AOP, elastic scales, VT and recruitment thresholds.
    # Consolidated tissue is its explicit complementary fraction.
    for i in range(1, 8):
        fr = i / 10
        altered = replace(lung, tissue=(0.2, fr, 0.8 - fr))
        sensitivity.append({"recruitable_tissue": fr,
                            **ri_analogue(altered, vt=vent.vt)})
    return {"version": VERSION, "python": platform.python_version(),
            "source_sha256": hashlib.sha256(
                Path(__file__).read_bytes()).hexdigest(),
            "status": "illustrative computational results, not validation",
            "cases": cases, "mechanical_fraction_sensitivity": sensitivity}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", default="results")
    parser.add_argument("--config", help="JSON with lung/vent/gas/history")
    args = parser.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    if args.config:
        config = json.loads(Path(args.config).read_text())
        require(set(config) <= {"lung", "vent", "gas", "history"},
                "Unknown configuration key")
        lung = Lung(**config.get("lung", {}))
        vent = Vent(**config.get("vent", {}))
        gas = Gas(**config.get("gas", {}))
        history = config.get("history", [vent.peep])
        result = {"version": VERSION,
                  "source_sha256": hashlib.sha256(
                      Path(__file__).read_bytes()).hexdigest(),
                  "lung": asdict(lung), "vent": asdict(vent),
                  "gas": asdict(gas), "history": history,
                  "outputs": evaluate(lung, vent, gas, history),
                  "ri": ri_analogue(lung, vt=vent.vt),
                  "peep_trial": peep_trial(lung, vent)}
        (out / "scenario.json").write_text(
            json.dumps(result, indent=2, allow_nan=False) + "\n")
        print("Saved", out / "scenario.json")
        return
    result = run_benchmarks()
    (out / "benchmark.json").write_text(
        json.dumps(result, indent=2, allow_nan=False) + "\n")
    for case in result["cases"]:
        row = case["outputs"]
        print(f'{case["name"]:10s} P/F={row["pf"]:6.1f} '
              f'Pplat={row["pplat"]:5.1f} '
              f'MP={row["mp_integral_J_min"]:5.1f} '
              f'R/I*={case["ri"].get("ri_signed", float("nan")):.3f}')
    print("Saved", out / "benchmark.json")


if __name__ == "__main__":
    main()
