# Shimayoshi dynamic respiratory-acidosis surrogate validation

Date: 2026-10-11

## Candidate

The candidate was fitted only to the validated single-step source grid
(10, 15, 20, 25, and 30 percent CO2 challenge trajectories).

State equations:

```
dXfast/dt = (A(CO2) - Xfast) / tau_fast(CO2)
dXslow/dt = (B(CO2) - Xslow) / tau_slow(CO2)

stress_ratio = 1 - Xfast + Xslow
```

No HR, MAP, CO, SV, SVR, arterial pH, or clinical outcome was used for fitting.

## Blind source experiment

The candidate parameters were committed before the multistep source result was
read.

Pinned upstream:
`atakeuti/TS-AT-SM-2026-IRmodel@6478d2ab0acbfc88d3da461d2594658bcb2798ca`

Blind workflow:
`38166194835`

Artifact:
`11712456381`

Digest:
`sha256:c0248ab642d59a1aaa79e335f2fd45c98c911400c7811721a50b4d576a6d583a`

Source schedule:

```
0-300 s    5% CO2
300-420 s 15%
420-540 s 25%
540-660 s 10%
660-780 s 30%
780-900 s 20%
900-960 s  5%
```

Only the source CO2 stimulus schedule was changed. The Shimayoshi cell equations
were not changed.

## Blind result

Across 2400 source cycles:

- RMSE stress ratio: 0.003625
- mean absolute stress-ratio error: 0.002473
- maximum absolute stress-ratio error: 0.010574
- maximum relative stress-ratio error: 1.108%

Maximum relative error by segment:

- initial control: 0.00015%
- 15% CO2: 0.496%
- 25% CO2: 0.580%
- 10% CO2: 0.977%
- 30% CO2: 0.861%
- 20% CO2: 0.465%
- recovery: 1.108%

The largest relative error occurred at 908.8 s during recovery.

## Interpretation

This supports a stateful two-timescale surrogate substantially better than a
static pH-to-contractility rule. It successfully preserved history across both
upward and downward CO2 transitions in a source trajectory that was not used
for fitting.

It remains a **shadow model**.

Remaining limitations:
1. The validated challenge grid currently has a gap between source baseline
   5% and the first challenge level at 10%.
2. The blind protocol used stepwise changes, not continuously varying CO2.
3. Whole-heart LV-pressure coupling remains non-authoritative.
4. This result is source-model validation, not clinical validation.


Durable validation artifact:
`artifacts/v1.5/SHIMAYOSHI_DYNAMIC_CO2_BLIND_VALIDATION_V2.json`
