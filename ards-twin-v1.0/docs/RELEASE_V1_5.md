# HumMod / Vent Formal v1.5 Evaluation Build

Date: 2026-10-10
Status: formal evaluation build
Source branch: `v1.5`
Frozen evaluation branch: `v1.5-release`
Package version: `1.5.0`

## Purpose

Provide a stable build for direct evaluation of the v1.5 physiology architecture without activating unvalidated controller ownership.

## Included in formal v1.5

### Autonomic / chemoreflex
- published Ursino/Magosso peripheral O2 chemoreceptor shadow;
- published CNS hypoxia terms;
- actual Vent VT-driven lung-stretch feedback;
- published arterial-pressure-derived Ursino baroreceptor afferent `f_ab`;
- end-to-end shadow `f_sp`, `f_sh`, and `f_v`;
- side-by-side native HumMod and published-model diagnostics;
- no shadow output has authority over HR, SVR, venous tone, or SA-node behavior.

### Oxygen transport
- Cain/Schumacker foundational DO2-VO2/extraction physiology in the literature stack;
- regional oxygen-transport audit;
- global convective DO2, extraction, supply-deficit, and oxygen-debt visibility;
- Cheng/Albanese/Ursino/Chbat integrated-model evidence anchor;
- microcirculation and sepsis-extraction layers fail closed pending quantitative source equations;
- no Cain animal DO2crit is used as a universal patient threshold;
- the existing 15-mmHg venous PO2 floor is explicitly labeled a provisional engineering boundary.

### Respiratory control
- Hennigs respiratory-center architecture and typed interface;
- no Hennigs gain/equation is activated until complete primary-source transcription is available.

### Sepsis / inflammation
- Yamanaka source equations available as parameterized shadow disease functions;
- source-backed sympathetic-fatigue candidate retained as disease-layer shadow only;
- Foteinou/Scheff inflammation-autonomic contract remains fail closed.

## Known intentional blockers

1. Magosso/Ursino 2001 peripheral O2-CO2 Eq. 1 piecewise interaction term requires exact primary-source transcription before activation.
2. Ursino heart-period effector requires complete primary-source gain/delay/time-constant transcription.
3. Hennigs respiratory-center implementation requires complete primary equation/parameter transcription.
4. Microcirculatory and sepsis extraction modifiers require a selected quantitative source model.
5. Aortic CaO2-content chemoreflex remains HOLD.
6. Fever/temperature chronotropy remains HOLD.

## Evaluation UI

The formal v1.5 monitor exposes:

- native HumMod sympathetic/vagal/SA-node outputs;
- Ursino `f_ab`, `f_ac`, `f_ap`, `theta_sp`, `theta_sh`, `f_sp`, `f_sh`, and `f_v`;
- global convective DO2;
- global extraction ratio;
- O2 supply deficit;
- accumulated oxygen debt;
- time trends for native and shadow autonomic states and oxygen transport.

All shadow outputs are labeled evaluation-only and non-authoritative.

## Release policy

This release is intended for scientific/engineering evaluation of model behavior. It is not clinically validated and must not be used for patient care.

No physiological gain, mapping, threshold, or fitted relationship may be promoted to control authority without explicit published provenance, unit mapping, deterministic tests, shadow validation, and an explicit activation decision.
