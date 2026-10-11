# Shimayoshi dynamic respiratory-acidosis surrogate

Date: 2026-10-11

## Purpose

This is the first source-derived acidosis model intended to preserve myocardial
history under changing CO2 exposure.

It remains a **shadow model** with no closed-loop pressure authority.

## Source data

Pinned source:
`atakeuti/TS-AT-SM-2026-IRmodel@6478d2ab0acbfc88d3da461d2594658bcb2798ca`

Training data:
- fixed 10% CO2 source trajectory
- fixed 20% CO2 source trajectory
- fixed 30% CO2 source trajectory

Held out from fitting:
- fixed 15% CO2 trajectory
- fixed 25% CO2 trajectory
- multistep dynamic source trajectory from workflow run `38166194835`

No HR, MAP, CO, SV, SVR, arterial pH, or bedside target was used.

## State equations

```
dx_fast/dt = (Aeq(u) - x_fast) / tau_fast(u)
dx_slow/dt = (Beq(u) - x_slow) / tau_slow(u)

stress_ratio = 1 - x_fast + x_slow
```

with:

```
q = (u - 5) / 25
Aeq(q) = a1*q + a2*q^2
Beq(q) = b1*q + b2*q^2
tau_fast(q) = exp(logTauFast0 + logTauFast1*q)
tau_slow(q) = exp(logTauSlow0 + logTauSlow1*q)
```

The two internal states provide memory. They replace the invalid assumption
that force is a memoryless function of instantaneous CO2 or intracellular pH.

## Validation

Held-out fixed-step source runs:
- 15%: maximum relative stress-ratio error about 0.52%
- 25%: maximum relative stress-ratio error about 1.01%

Held-out multistep source run:
- mean absolute stress-ratio error about 0.00172
- maximum absolute stress-ratio error about 0.00805
- maximum relative stress-ratio error about 0.86%

For comparison, the memoryless compressed fixed-step grid reached about 8.29%
maximum relative error on the same dynamic source experiment.

## Limits

- Validated source CO2 domain: 5-30%.
- The model predicts source peak-Fb ratio only.
- It is not clinical validation.
- It does not directly modify HR, SVR, MAP, CO, or SV.
- Whole-heart coupling remains shadow-only until the dynamic surrogate is
  independently regression-tested through the Kato/Utaki pressure bridge.
