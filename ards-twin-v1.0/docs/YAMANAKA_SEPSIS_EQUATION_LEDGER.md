# Yamanaka Sepsis Equation Ledger

Status: source equations transcribed; parameterized shadow functions permitted; disease-state activation prohibited
Date: 2026-10-10

## Primary source

Yamanaka Y, Uchida K, Akashi M, et al. Mathematical modeling of septic shock based on clinical data. Theor Biol Med Model. 2019;16:5. DOI: 10.1186/s12976-019-0101-9. PMID: 30841902.

## Source-backed disease links

The paper connects inflammation `N*` to the cardiovascular system through three explicit mechanisms:

1. increased capillary permeability;
2. vasodilation;
3. reduced left stroke volume / myocardial performance.

### Equation 29 — inflammation to capillary permeability

```
La =
  (La_max - La_min)
  / [1 + (EC50_La / N*)^slopeLa]
  + La_min
```

Implementation rule:
- all parameters must be supplied from the published parameter table or a separately documented calibrated set;
- no defaults are invented.

### Equation 30 — inflammation to vasodilation

```
Ar -> Ar - EX

EX =
  k_EX
  / [1 + (EC50_EX / N*)^slopeEX]
```

This modifies the pre-existing sympathetic radius factor rather than acting as a direct SVR multiplier.

### Equation 31 — inflammation to stroke-volume depression

```
Sl = S0 / [1 + k_s * g(N*)]
```

The source function `g` is defined by the immune-system model and includes anti-inflammatory mediation.

## Sympathetic fatigue — Equations 17 and 18

```
dgamma/dt = (a - a0) / tau_gamma
```

```
a =
  (a_max - a_min)
  / [1 + exp(-DeltaX/X0 + gamma)]
  + a_min
```

This establishes a published mathematical fatigue/desensitization candidate. It must remain a disease-layer state and must not be used to repair normal autonomic physiology.

## Project rule

The Yamanaka layer is downstream of a validated normal autonomic controller. It cannot become authoritative until:
- its parameter tables are fully transcribed with units;
- its immune-state variable ownership is defined;
- capillary-volume accounting is reconciled with HumMod;
- vasodilation is mapped to the correct resistance/radius state;
- myocardial depression is mapped without double-counting existing HumMod cardiac failure;
- sepsis reference trajectories are validated in shadow mode.
