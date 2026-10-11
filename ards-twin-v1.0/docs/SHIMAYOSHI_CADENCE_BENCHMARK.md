# Shimayoshi source cadence benchmark

Date: 2026-10-11
Pinned upstream commit: `6478d2ab0acbfc88d3da461d2594658bcb2798ca`
Status: control-state benchmark complete; 0.2 ms long-run candidate pending challenge-onset validation

## Purpose

Reduce source extraction runtime without changing the Shimayoshi equations.

The source executable uses `stepint` as the requested CVODE target/output cadence.
The ODE equations, model parameters, stimulus timing, and protocol equations are
unchanged. Because peak `Fb` is sampled at this cadence, coarser values must be
validated against the original 0.1 ms source cadence.

## Control benchmark

Two paced control cycles (0.8 s total) were run from the same pinned source and
initial conditions.

Reference 0.1 ms mean peak Fb:

```
6.041059088461671 mN/mm^2
```

Relative errors versus 0.1 ms:

| CVODE target cadence | mean peak Fb | pHi | O2i | ATP total | PCr | Pi | mean peak Cai |
|---|---:|---:|---:|---:|---:|---:|---:|
| 0.2 ms | 5.09e-8 | 4.61e-12 | 1.76e-11 | 1.91e-11 | 1.05e-10 | 1.82e-10 | 2.97e-6 |
| 0.4 ms | 1.28e-6 | 2.83e-7 | 4.86e-7 | 5.78e-7 | 3.62e-6 | 3.65e-5 | 3.81e-4 |
| 1.0 ms | 1.54e-4 | 1.22e-6 | 2.26e-6 | 2.52e-6 | 1.69e-5 | 1.70e-4 | 1.05e-3 |

Extracellular O2 was identical in all control comparisons.

## Decision

Use **0.2 ms** as the candidate cadence for the first long source trajectory.

This is not yet a global equivalence claim. The first long respiratory-acidosis
run must also be compared cycle-by-cycle against a native 0.1 ms run through
the perturbation onset. If the challenge comparison shows material divergence,
the long-run cadence must be reconsidered.

No HR, MAP, CO, SV, SVR, or other bedside output was used to select the cadence.
