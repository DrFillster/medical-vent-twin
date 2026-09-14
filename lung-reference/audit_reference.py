"""Produce additional sensitivity/convergence records without dependencies.
Run after the benchmark: python audit_reference.py
"""
from dataclasses import replace
from pathlib import Path
import json
import lung_reference as m


def main():
    _, lung, vent, gas = m.illustrative_cases()[-1]
    state = m.state_after(lung, (30, vent.peep))
    power = [{"intervals": n,
              "mp": m.mechanics(lung, vent, state, n=n)
              ["mp_integral_J_min"]} for n in (60, 120, 240, 480)]
    resolution = []
    for units in (64, 128, 256, 512):
        model = replace(lung, units=units)
        trial = m.peep_trial(model, vent)
        resolution.append({"relays": units,
                           "ri": m.ri_analogue(model, vt=vent.vt),
                           "max_crs_peeps": trial["max_crs_peeps"]})
    aop = [{"aop": a, **m.ri_analogue(replace(lung, aop=a), vt=vent.vt)}
           for a in (0, 2, 4, 6, 8, 10, 12, 14, 15, 16)]
    # All thresholds are above AOP: this sweep shifts their airway values.
    vt = [{"vt_L": v, **m.ri_analogue(lung, vt=v)}
          for v in (.20, .28, .36, .42, .50)]
    fio2 = [{"fio2": f,
             **m.gas_exchange(lung, replace(vent, fio2=f), state, gas)}
            for f in (.21, .30, .40, .60, .80, 1.0)]
    result = {"power_resolution": power, "relay_resolution": resolution,
              "aop_sensitivity": aop, "tidal_volume_sensitivity": vt,
              "fio2_sensitivity_fixed_state": fio2}
    Path("results").mkdir(exist_ok=True)
    Path("results/audit.json").write_text(
        json.dumps(result, indent=2, allow_nan=False) + "\n")
    print("Saved results/audit.json")


if __name__ == "__main__":
    main()
