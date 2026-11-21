# Fixed-parameter gas-balance audit - 2026-11-21

## Completed

Three fresh 1800-second unchanged-setting replays of the selected strict-input
acid-base refinements, no retuning. Read-only process-local capture of actual
gas runtime snapshots; no production equations/files changed. 183 snapshots
at 30-second spacing, each includes boundary, state, exchange, targets and
session gas outputs. All finite. Each 600-second endpoint reproduces its prior
un-instrumented confirmation within relative/absolute numerical tolerance 1e-8.
This checks observer/replay agreement, not clinical measurement tolerance.

## Findings

First and third cases show near-plateau gas values by the later observations,
but at values different from measured baseline. Second case continues toward
high CO2 and low pH; even its ten-minute result understated the later mismatch.
No formal stationarity threshold or continuous slope estimate applied. Merely
waiting longer is not a demonstrated rescue of any selected configuration.

All three use the same reference tissue O2 demand (250 mL/min) and CO2 production
(8.92 in runtime-labeled mmol/min). These are model inputs, not measured patient
metabolism. Dynamic ventilatory/alveolar and pulmonary-flow boundaries differ
between cases. The second case shows CO2 outflow below production at the sampled
initial, one-, ten-, twenty- and thirty-minute points; CO2 rises during that
interval. This is consistent with a ventilation/metabolism mismatch under these
assumptions, not proof of the true patient's metabolic rate or disease.

O2 uptake is near modeled tissue use at late sampled points even in the case
whose arterial oxygen disagrees with baseline. Exchange-rate balance therefore
does not establish correct arterial oxygen representation. Circulation,
ventilated fraction, recruitment, membrane and boundary settings remain possible
contributors, not diagnoses established by this experiment.

Instantaneous CO2 outflow varies with respiratory-cycle sampling in other cases.
Do not infer a mean balance or whole-body conservation from sparse points.
The reduced runtime uses first-order arterial/venous concentration delays,
not explicit volume-weighted whole-body CO2 inventories. Thus this trace is
an exchange/target/state audit, not a whole-body conservation proof. Runtime
unit labels also require source-equation review before clinical interpretation.

## Next bounded experiment

Use the retained mechanics ensembles, not just these selected winners, for a
long-horizon pre-change fit objective. Check actual terminal behavior during
selection rather than selecting only at 60 seconds and discovering drift later.
Review metabolic boundary provenance/units and patient data availability before
introducing patient-specific metabolic freedom. Carry oxygen-flow/recruitment
assumptions explicitly; resolve source-block mismatch in the withheld fourth
case. Do not change limits or label disease to make a fit pass. Full baseline
and cardiovascular qualification remain pending. Production and independent
cohort unchanged; no post-change files used.

## Checks

Run contract verifies all cases/time samples, finite outputs, fixed SID/metabolic
inputs/FiO2, and 600-second replay agreement. Six existing simulation programs
and deterministic independent-controls runner test pass. Known legacy recruitment
mismatch remains unresolved, not repaired by a passing regression test. Patient
records remain outside GitHub. No clinical qualification claim added.
