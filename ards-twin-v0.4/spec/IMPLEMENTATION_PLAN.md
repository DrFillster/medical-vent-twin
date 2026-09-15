# Implementation Plan

## Milestone 0 — Freeze current reference
- Preserve current v0.2.0-rc1 behavior and tests.
- Tag or copy reference engine namespace.
- Generate canonical JSON records for the four current presets.
- No changes to equations except bug fixes separately documented.

## Milestone 1 — Simulation clock + state container
- Add deterministic `SimulationClock`.
- Add `PatientParams`, `PatientState`, `VentilatorSettings`, `VentilatorRuntime`.
- Implement headless stepping and trace capture.
- No new physiology yet.

Acceptance: a no-op model advances deterministically and reproduces identical traces across repeated runs.

## Milestone 2 — Dynamic passive mechanics
- Implement independent compartment R/C state.
- Central airway node + compartment branches.
- Keep recruitment fixed.
- Support pressure and flow boundary conditions.

Acceptance:
- conservation tests pass
- single-compartment analytic/limiting cases pass
- convergence with timestep refinement demonstrated

## Milestone 3 — VC-A/C
- Square-flow VC first.
- RR, Vt, PEEP, FiO2, inspiratory flow, inspiratory pause.
- Passive patient only.
- Generate Paw/flow/volume waveforms.

Acceptance:
- delivered Vt matches target in valid cases
- Ppeak > Pplat when resistance > 0
- Ppeak approaches Pplat as resistance approaches zero
- expiratory state returns to baseline when time constants permit complete exhalation
- end-inspiratory quasi-static state is compared with current reference model where assumptions overlap

## Milestone 4 — PC-A/C
- Pressure target above PEEP
- inspiratory time
- rise time

Architecture acceptance test: patient mechanics module remains unchanged.

## Milestone 5 — Dynamic recruitment/derecruitment
- Port relay thresholds as independent model concept, not code copy from external projects.
- Recruitment state may change within breath.
- Define whether switching is instantaneous or time-dependent; make this an explicit model assumption.

Acceptance:
- hysteresis tests
- threshold ordering tests
- same set PEEP can yield different state after different pressure history

## Milestone 6 — Compartmental gas exchange
- individual compartment ventilation
- independent perfusion fractions
- O2/CO2 exchange per compartment
- blood-content mixing after compartment exchange
- explicit shunt and dead-space pathways

Do not claim validation until external references are specified and tested.

## Milestone 7 — Spontaneous breathing / PSV
Deferred until passive modes are stable.
