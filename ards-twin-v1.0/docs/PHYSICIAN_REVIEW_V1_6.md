# v1.6 Physician Review Build

Timestamp: 2026-10-13
Branch: `v1.6`
Review baseline HEAD before this documentation commit: `a2b37443d0fccf37ec0aab0d5a200cc86da2f216`

## Purpose

This build is for physician review of the evolving cardiopulmonary digital twin. HumMod is a source/donor/comparator, not the acceptance standard. No equation should be changed only to make the model agree with an older HumMod baseline or with a preconceived bedside result.

## Current architecture

The persistent v1.6 physician candidate composes:

1. Vent mechanical lung model and persistent recruitment state.
2. Reference-anchored conversion of Vent distal elastic-volume change to an absolute alveolar-volume coordinate.
3. Passive Albanese A34/A40 pleural/alveolar pressure coordinates.
4. Karamolegkos-family pulmonary vascular/RV-loading runtime.
5. Das/Marshall-family regional V/Q and hypoxic pulmonary vasoconstriction candidate.
6. HumMod-source-aligned reduced gas/acid-base state.
7. Ursino/Magosso-family cardiovascular/autonomic candidate.
8. Bedside outputs and respiratory-mechanics maneuvers on the same persistent patient.

The composition layer uses sequential operator splitting and does not add a fitted physiologic gain.

## Provenance classification

- **Source-derived/source-family:** HumMod gas/acid-base equations and delays; Albanese pressure-coordinate equations; Karamolegkos pulmonary vascular model family; Ursino/Magosso cardiovascular/autonomic family.
- **Literature-derived extensions:** regional V/Q/HPV composition using the Das/Marshall source family and published pulmonary/cardiopulmonary model components.
- **Engineering assumptions/boundaries:** numerical coupling, explicit fixture values used by focused regression tests, and any provisional reduced-order extraction boundaries explicitly labeled as such.
- **Validated empirical behavior:** limited to behavior directly demonstrated by focused tests or physician review. A green software test is not evidence that a physiologic trajectory is clinically validated.

## What is working

- One persistent bedside ARDS patient state.
- PEEP changes preserve state and intervention history.
- VT, RR, and FiO2 changes apply at a breath boundary without patient reset.
- Inspiratory/expiratory holds advance the same coupled patient and produce measurements.
- Regional ventilation, alveolar oxygen, HPV, and perfusion are represented as distinct states.
- Anatomical shunt remains an explicit case/source boundary and is not inferred from low V/Q or recruitment.
- Focused physician candidate test: 5 passed, 0 failed in the saved local run.

## Findings requiring physician review

### Oxygen trajectory

The regional oxygen calculation can move quickly after a ventilator change while the persistent arterial oxygen-content state follows the existing HumMod-derived first-order gas-state delay. The current audit therefore shows a meaningful distinction between:

- regional arterial O2 target,
- applied arterial O2-content target,
- actual arterial O2 state,
- venous O2 state,
- oxygen delivery/use.

Do not tune the oxygen equations until the diagnostic trace determines whether an unexpected bedside PaO2 trajectory is caused by regional V/Q, state lag, blood-O2 conversion, or coupling order.

### Autonomics

The active cardiovascular/autonomic candidate receives PaO2, PaCO2, and delivered tidal volume. Source-family chemoreceptor, sympathetic, vagal, and SA-node states exist, but the current physician perturbation case does not establish the severe hypoxia/hypercarbia -> autonomic -> tachycardia behavior. Review the full chain before changing gains.

### Positive-pressure cardiovascular coupling

Pulmonary vascular/RV-load coupling now receives lung pressure/volume coordinates. Direct pleural/intrathoracic pressure coupling into systemic cardiovascular chamber transmural pressures and venous return is not yet complete. Therefore, v1.6 contains partial but not complete mechanical heart-lung interaction.

### Explicit case boundaries

Focused physician fixtures include explicit anatomical shunt, absolute alveolar reference volume, and pleural-pressure reference values. Their presence in a source-qualified interface means the interface requires provenance; it does not make an arbitrary fixture value physiologically authoritative.

## Current physician audit behavior

The saved perturbation audit demonstrated software continuity and produced finite bedside variables. It also showed behavior that needs review rather than tuning:

- PEEP 10 -> 14 cmH2O: PaO2 decreased in the sampled interval while CO decreased modestly and PVR/mPAP increased modestly.
- FiO2 0.60 -> 0.80: regional alveolar PO2 increased substantially, while the reported arterial PaO2 had not yet followed that change in the sampled interval.
- HR remained near/below baseline in this non-extreme test and therefore does not validate the severe-stress chronotropic response.

These are review observations, not pass/fail physiologic targets.

## Review decision

Keep the v1.6 architecture. Do not revert it to preserve historical HumMod behavior.

Before declaring physiology validation, review:

1. oxygen target vs persistent arterial-state time course,
2. severe hypoxia/hypercarbia autonomic response,
3. PEEP/intrathoracic-pressure effects on systemic venous return and chamber transmural pressure,
4. explicit case-boundary values and provenance.

No physiology change is authorized by this document. The purpose is to expose the current model cleanly for physician judgment.
