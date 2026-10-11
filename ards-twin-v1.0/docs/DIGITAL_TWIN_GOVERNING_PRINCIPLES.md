# Digital Twin Governing Principles

Date: 2026-10-11
Status: governing architecture rule

## Product definition

The product is a **digital twin of one persistent patient**.

The physician-facing application does not exist to decide whether HumMod, Ursino,
Karamolegkos, CircAdapt, Hennigs, Shimayoshi, or another model is “right.”
Those models are development inputs.

The physician should see one evolving patient state.

## Ownership rule

Every canonical physiologic state variable has one active owner.

Examples:
- Vent: high-resolution lung and ventilator mechanics.
- Selected pulmonary vascular model: pulmonary pressures, vascular resistance,
  and flow redistribution when its validation gate is passed.
- Selected cardiovascular plant: chamber/circulatory state.
- Selected autonomic controller: autonomic state.
- Selected myocardial energetic model: intracellular energetic/contractile state.

Competing models may run in research shadow mode while we choose an owner, but
they are not co-equal bedside outputs and they are not averaged together.

## Selection rule

A subsystem becomes authoritative for the digital patient because:

1. its equations and parameters are traceable to a primary source;
2. the source model can be reproduced;
3. its operating domain matches the intended patient state;
4. its required inputs can be supplied without an invented physiologic bridge;
5. its outputs validate against independent human/experimental physiology;
6. its coupling to adjacent subsystems preserves conservation laws and units.

Agreement with HumMod is not required.

Agreement between competing models is not required.

## Equation rule

For every active physiologic relationship, preserve:

- primary citation;
- exact equation number or source-code location;
- variables and units;
- parameter value and provenance;
- original validation population;
- intended physiologic effect;
- any coordinate/unit adapter used to connect subsystems;
- authority state.

If an equation, parameter, or cross-model adapter is not source-complete, the
implementation must fail closed or remain research-only. It must not be filled
with a guessed gain to make the patient “look right.”

## Physician-facing rule

The default physician surface shows canonical patient variables, not model
comparisons.

Primary examples:
HR, MAP, CO, SV, SVR, PVR, CVP/RAP, PAP, SpO2/SaO2, PaO2, PaCO2, pH,
SvO2/PvO2 when valid, ventilator settings, PEEP, peak pressure, plateau
pressure, total PEEP, driving pressure, tidal volume, respiratory rate, and
compliance.

Model-internal signals and alternate-model outputs belong in research
diagnostics only.

## Validation rule

The decisive question is:

> Does the persistent patient respond to clinically meaningful perturbations
> with direction, magnitude, timing, coupling, and recovery that are defensible
> against independent physiology?

The core physician challenge suite is:

1. hypoxia;
2. hypercapnia / respiratory acidosis;
3. combined hypoxic-hypercapnic failure;
4. PEEP / mechanical-ventilation intervention;
5. recovery;
6. sufficiently severe progression into cardiovascular/myocardial failure.

No scenario outcome is scripted merely because it is expected clinically.
