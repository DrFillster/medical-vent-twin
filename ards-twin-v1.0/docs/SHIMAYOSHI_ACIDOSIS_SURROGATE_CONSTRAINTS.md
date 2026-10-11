# Shimayoshi acidosis surrogate constraints

Date: 2026-10-11

Pinned upstream source:
`atakeuti/TS-AT-SM-2026-IRmodel@6478d2ab0acbfc88d3da461d2594658bcb2798ca`

Validated source artifact:
GitHub Actions run `38151204764`, respiratory-acidosis challenge.

## pHi alone is insufficient

The validated full source trajectory contains cycles with nearly identical
intracellular pH but materially different active cross-bridge force.

Example:

| Source time | Phase | pHi | peak Fb (mN/mm^2) |
|---|---|---:|---:|
| 335.6 s | acidosis | 6.904325543953583 | 5.530918848950123 |
| 939.2 s | recovery/control | 6.904313766551565 | 6.067052965295824 |

The pHi difference is approximately `1.18e-5`, while peak Fb differs by
approximately `0.536 mN/mm^2`.

Therefore a deterministic mapping of the form

```
Fb = f(pHi)
```

cannot reproduce the source trajectory.

This is source hysteresis/state dependence, not a reason to fit an empirical
bedside correction.

## Surrogate architecture rule

The browser surrogate must preserve source history/state.

Current permitted approach:

```
source CO2 challenge/state + source-protocol time/history
    -> bounded interpolation within validated Shimayoshi source runs
    -> source peak Fb
```

The surrogate:

- targets source `Fb`, not HR/MAP/CO/SV/SVR;
- does not extrapolate outside the validated CO2/time domain;
- remains shadow-only;
- does not convert arterial pH directly into contractility;
- must pass leave-one-challenge-out source validation before integration.

A future cross-model adapter may use HumMod myocardial tissue CO2/acid-base
state only after the unit/state correspondence with the Shimayoshi
extracellular CO2 input has been explicitly verified.
