# Chronotropy Candidate Equation Ledger

Date: 2026-10-11
Candidate: Ursino/Iwamoto heart-period effector
Authority: **candidate only; not yet canonical HR owner**

## Purpose

The digital twin needs one authoritative heart-rate state. The current v1.5
patient still uses a reduced HumMod SA-node pathway, while an Ursino/Magosso
controller runs as a research shadow.

This candidate isolates the **heart-period effector** so it can be evaluated as
a possible owner of canonical HR without requiring agreement with HumMod.

## Primary implementation source

Masami Iwamoto, Satoko Hirabayashi, Noritoshi Atsumi.
**In-silico simultaneous respiratory and circulatory measurement during voluntary
breathing, exercise, and mental stress: A computational approach.**
PLoS Computational Biology. 2024;20(12):e1012645.
DOI: 10.1371/journal.pcbi.1012645.
PMID: 39689064. PMCID: PMC11651585.

The 2024 paper explicitly states that its circulatory control is based on Ursino
(1998), reproduces the effector equations, provides the parameters in Table 3,
and validates integrated HR/BP/respiratory responses against human data.

Lineage source:

Mauro Ursino.
**Interaction between carotid baroregulation and the pulsating heart: a
mathematical model.**
Am J Physiol Heart Circ Physiol. 1998;275:H1733-H1747.
DOI: 10.1152/ajpheart.1998.275.5.H1733.

Related heart-period analysis:

Mauro Ursino, Elisa Magosso.
**Role of short-term cardiovascular regulation in heart period variability:
a modeling study.**
Am J Physiol Heart Circ Physiol. 2003;284:H1479-H1493.
DOI: 10.1152/ajpheart.00850.2002.

## Authoritative equations

Iwamoto 2024 Eq. 26: sympathetic static effector for controlled variable j

```
if f_es(t-D_j) >= f_es,min:

  delta_theta_bar_j(t)
    = G_j * ln[f_es(t-D_j) - f_es,min + 1]

else:

  delta_theta_bar_j(t) = 0
```

For heart period, `j = 7`.

Iwamoto 2024 Eq. 27: sympathetic first-order dynamics

```
tau_j * d(delta_theta_j)/dt
  = -delta_theta_j + delta_theta_bar_j
```

Iwamoto 2024 Eq. 28: vagal static heart-period effect

```
delta_T_bar_v(t) = G_v * f_ev(t-D_v)
```

Iwamoto 2024 Eq. 29: vagal first-order dynamics

```
tau_v * d(delta_T_v)/dt
  = -delta_T_v + delta_T_bar_v
```

Iwamoto 2024 Eq. 30: total heart period

```
T(t) = theta_7^0 + delta_theta_7(t) + delta_T_v(t)
```

The simulator reports heart rate from the reciprocal definition

```
HR = 60 / T
```

when `T` is in seconds.

## Source parameters

Iwamoto 2024 text and Table 3 / Ursino lineage:

| Parameter | Value | Meaning |
|---|---:|---|
| f_es,min | 2.66 spikes/s | minimum sympathetic stimulation |
| G_7 | -0.13 | heart-period sympathetic gain |
| tau_7 | 2 s | sympathetic heart-period time constant |
| D_7 | 2 s | sympathetic pure latency |
| theta_7^0 | 0.58 s | intrinsic/baseline heart period term |
| G_v | 0.09 s/Hz | vagal heart-period gain |
| D_v | 0.2 s | vagal pure latency |
| tau_v | 1.5 s | vagal heart-period time constant |

The code preserves the published numerical values and does not refit them.

## Intended effect

- Increased cardiac sympathetic firing above 2.66 spikes/s produces a negative
  heart-period contribution, shortening T and increasing HR.
- Increased vagal firing produces a positive heart-period contribution,
  lengthening T and decreasing HR.
- Both branches include source-specified latency and first-order dynamics.

## Numerical implementation

The source ODEs are integrated with the exact closed-form first-order update for a
piecewise-constant target over each simulator step:

```
x(t+dt) = target + [x(t)-target] * exp(-dt/tau)
```

This changes the numerical integration method, not the source physiology, and
avoids timestep-dependent forward-Euler error.

Delayed firing rates are linearly interpolated from timestamped source inputs.

## Validation scope

Iwamoto 2024 is a human integrated respiratory-circulatory model and reports
comparison with human experimental data during:
- voluntary breathing at different breathing rates;
- short-term exercise;
- mental stress.

This supports the heart-period effector as a human-model candidate.

It does **not** by itself establish that the full Iwamoto autonomic afferent model
is the best controller for severe ICU hypoxia/hypercapnia. In this project the
heart-period effector can be paired with separately selected, source-complete
cardiac sympathetic and vagal efferent signals.

## Authority gate

This candidate must not own bedside HR until:

1. the upstream cardiac sympathetic signal has an authoritative source and units;
2. the upstream cardiac vagal signal has an authoritative source and units;
3. the combined controller is tested against independent human hypoxia,
   hypercapnia, combined respiratory-failure, and recovery trajectories;
4. the selected cardiovascular plant accepts HR without a second competing HR
   owner.

No HumMod agreement requirement exists.
