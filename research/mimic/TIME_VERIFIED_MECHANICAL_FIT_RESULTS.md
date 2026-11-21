# Time-verified pre-change mechanical fitting - 2026-11-21

## What changed

Built fresh input packets for all 19 development events without reading saved
prefits or outcome files. Settings require charttime AND storetime before the
transition within two hours; arterial gases require all three matching raw
components from the same specimen available before cutoff within four hours.
Older complete specimens may replace a latest specimen with delayed results.
All 19 have an available complete gas under this selection. Four have all
required settings plus CPAP/PSV mode documented under the two-hour rule.

The other 15 remain documented exclusions, not patient-fit failures. Missing
mode history occurs in 15 cases, FiO2 in eight, PEEP/PS in ten each; counts
overlap. Not proof that the clinical setting was unknown: sparse charting and
the chosen history window may exclude otherwise usable records. Mode source
currently item 223849 only, not alternate Hamilton mode item. Inputs are
individually available but their co-temporality and stability are not established.
Do not substitute this denominator into the earlier 10/19 baseline result.

## Executed search

Four fresh mechanical searches, 88 candidates each: seven drive candidates,
then 81 independent elastic/capacity/resistance/transmission combinations at
selected drive. Total 352 short simulations, zero execution errors. Search
settings and objective written before execution. Statistical objective uses
proportional residuals in VT, minute ventilation and total RR when available;
raw measurement units checked. These correlated measurements are NOT three
independent constraints. Last completed breath, not multi-breath averages.

No prior fitted stiffness, drive, muscle or gas parameters reused. Blood-gas
targets not used for this mechanical search; reference gas defaults remain.
No disease labels assigned. Recruitment/reference boundaries remain unchanged.

## Result

Three of four selected parameter sets pass a prespecified engineering screen:
each available mechanical target within 20 percent plus approximate effort/
ventilator-breath count agreement. All three pass a fresh ten-minute replay
with no adjustment. Fourth case fails both short and ten-minute screens,
particularly respiratory rate. Zero confirmation execution errors.

This is mechanical target reproduction, not baseline gas qualification or
clinical validation. A previous gas-qualified case can fail the new mechanical
screen, and previous gas-failed cases can pass mechanics without gas recovery.
No claim of improving the earlier 10/19 clinical-baseline coverage.

All three passing cases have multiple passing candidate parameter sets (14,
6 and 17 short candidates respectively). VT/MV/RR do not uniquely identify
stiffness, capacity, resistance or muscle strength. Selected controls cannot
be read as verified disease states. Some optima are at grid boundaries. Drive
chosen before independent-controls grid, not a fully joint search; failure
is a failure of this bounded procedure, not proof of model impossibility.

## Integrity checks

Synthetic 19-case packet test verifies missing-mode rejection, late-store
exclusion and delayed-lab exclusion. Existing six simulation tests plus two
source tests pass. Contract checks all 352 attempts, four confirmations, strict
source timestamps, finite outputs and no old-prefit authorization. Source hashes
and input hashes recorded after launch as a reproducibility inventory, not
misrepresented as a prospectively frozen source manifest.

Patient records and numerical endpoints remain outside GitHub. Production and
independent cohort unchanged. Development outcomes were inspected earlier;
these scripts do not read them, but the project is not newly blinded.

## Next experiment

1. Review simultaneous setting/measurement context and alternate-mode history
   before broadening data availability; do not extend windows just to pass.
2. Carry all mechanically acceptable configurations, not just one best fit,
   into pre-change gas fitting and unchanged-setting qualification. Parameter
   ambiguity must propagate to predictions rather than disappear at selection.
3. Resolve fourth-case breath timing with joint drive/control assessment; retain
   failure. No tuning to the already-inspected post-change gas.
4. Only after full baseline qualification, fix parameters for paired intervention
   predictions and score on a separate patient-disjoint cohort.
