# Strict-input acid-base initialization review - 2026-11-21

## Correction to prior description

The patient gas initializer accepts measured pH, but the source code retains it
as a diagnostic: initialized pH is determined by the reduced chemistry and SID.
Passing pH to patientArterialGasInitialization does NOT enforce measured pH.
Earlier wording that all three measured gases were imposed at initialization
was too broad. O2/CO2 inverses and session-level initialization also require
separate checks; do not infer exact gas matching from the input payload.

## Paired experiment

Three time-verified, provisionally context-matched development cases. Their
previously selected mechanical controls and gas fractions remain fixed in a
three-condition comparison: reference SID + original initializer, fitted SID
+ original initializer, fitted SID + existing research-only venous correction.
The correction preserves reference venous PCO2 rather than reference venous
bicarbonate when SID changes; no patient venous measurement is invented.
Reference venous prior remains an assumption. No production module edited.

SID fitted to measured pre-change pH within the existing .005-.100 computational
envelope, not a physiological reference interval or measured patient SID.
All three original-initializer fitted sessions match initial pH within 1e-6.
This is constructed initial agreement, not predictive evidence. Nine fresh
600-second paired runs completed without execution errors. Venous correction
changes session-level initial outputs slightly and does not materially rescue
the failed long endpoints in this batch.

A first checker incorrectly demanded bitwise identical session-level pH across
venous-correction arms. It failed; this assumption was removed, not the data.
The retained contract checks equal experimental controls/SID/gas fractions,
original-arm fitted pH, finite outputs and fixed bounds. Session-level output
includes coupling effects and must be reported separately from pure initializer
state invariants already tested in the research correction.

## Local gas refinement

With fitted SID and the venous correction, test local gas-fraction offsets
inside the previous dead-space/perfusion envelopes. Mechanical controls fixed.
21 fresh 60-second candidates; best mechanical-consistent candidate per case
receives fresh 600-second replay. Objective adds a .05 pH normalization scale,
explicitly an engineering optimization weight, NOT an acceptance threshold.
No new pH pass threshold or clinical qualification assigned.

Nine paired runs + 21 local candidates + three confirmations = 33 dynamic
simulations; zero execution errors. Initialization-only solver probes counted
separately, not included in this dynamic-run total. All three refined selected
configurations preserve mechanical screen. One meets O2/CO2 endpoint limits;
none established as full baseline-qualified. pH still drifts after initially
matching pre-change measurement; oxygen failure remains in another case and
CO2 failure in another. Fixing time zero alone is not a steady-state solution.

## Next decision-free work

Before adding phenotype labels or expanding parameter freedom, trace conserved
CO2 pools, effective alveolar ventilation, metabolic production and O2/perfusion
balance under unchanged support. Compare early versus late slopes and sample
state boundaries; explicitly separate invalid assembled baselines, initializer
transients and genuine steady-state mismatch. Retain candidate ensembles and
keep post-change data out of fitting. Some coarse/local optima hit bounds;
no bound widening to force a pass. Reference recruitment/circulation and
unverified clinical steady exposure remain limitations. Production and
independent patient cohort unchanged; no post-change files read in this batch.
