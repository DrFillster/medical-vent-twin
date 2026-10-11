# Candidate Canonical HR Controller Ledger

Date: 2026-10-11
Authority: candidate only

## Objective

Construct one source-complete candidate chronotropic controller for the digital
patient. This is not a HumMod comparator. If this controller later passes the
external physiology gate, it may become the sole owner of canonical HR.

## Source chain

1. Arterial pressure -> baroreceptor afferent firing:
   Ursino 1998.
2. PaO2 + PaCO2 -> peripheral chemoreceptor and CNS gas offsets:
   Magosso & Ursino 2001.
3. Actual delivered tidal volume -> pulmonary stretch afferent:
   Ursino & Magosso 2000.
4. f_ab + f_ac + f_ap + CNS offsets -> cardiac sympathetic firing:
   Magosso & Ursino 2001.
5. f_ab + f_ac + f_ap -> cardiac vagal firing:
   Ursino & Magosso 2000 Eq. 23, unchanged as a cardiac vagal pathway.
6. cardiac sympathetic + vagal firing -> heart period -> HR:
   Iwamoto et al. 2024 Eqs. 26-30, Ursino lineage.

## Primary citations

- Ursino M. Interaction between carotid baroregulation and the pulsating heart:
  a mathematical model. Am J Physiol Heart Circ Physiol. 1998;275:H1733-H1747.
  DOI: 10.1152/ajpheart.1998.275.5.H1733.

- Ursino M, Magosso E. Acute cardiovascular response to isocapnic hypoxia.
  I. A mathematical model. Am J Physiol Heart Circ Physiol.
  2000;279:H149-H165. DOI: 10.1152/ajpheart.2000.279.1.H149.

- Magosso E, Ursino M. A mathematical model of CO2 effect on cardiovascular
  regulation. Am J Physiol Heart Circ Physiol. 2001;281:H2036-H2052.
  DOI: 10.1152/ajpheart.2001.281.5.H2036.

- Iwamoto M, Hirabayashi S, Atsumi N. In-silico simultaneous respiratory and
  circulatory measurement during voluntary breathing, exercise, and mental
  stress: A computational approach. PLoS Comput Biol. 2024;20:e1012645.
  DOI: 10.1371/journal.pcbi.1012645.

## Inputs

Canonical candidate inputs:
- systemic arterial pressure, mmHg;
- PaO2, mmHg;
- PaCO2, mmHg;
- actual delivered tidal volume, L;
- elapsed time, s.

No HumMod control variable is required.

## Outputs

- f_ab, spikes/s;
- f_ac, spikes/s;
- f_ap, spikes/s;
- f_sh, spikes/s;
- f_v, spikes/s;
- heart period, s;
- candidate HR, /min.

The controller also retains f_sp and f_sv for later vascular/venous effectors.

## Pulmonary stretch pathway

Ursino & Magosso 2000 Eqs. 19-20:

```
phi_ap(VT) = G_ap * VT
```

```
df_ap/dt = (-f_ap + phi_ap) / tau_p
```

with:
- G_ap = 23.29 spikes s^-1 L^-1
- tau_p = 2 s

The candidate uses actual delivered VT. It does not derive VT from blood gases.

## Cardiac vagal pathway

Ursino & Magosso 2000 Eq. 23:

```
f_v =
  f_ev,0
  + [ f_ev,infinity * exp((f_ab-f_ab,0)/k_ev) ]
    / [1 + exp((f_ab-f_ab,0)/k_ev)]
  + W_c,v*f_ac
  - W_p,v*f_ap
  - theta_v
```

Parameters:
- f_ev,0 = 3.2 spikes/s
- f_ev,infinity = 6.3 spikes/s
- f_ab,0 = 25 spikes/s
- k_ev = 7.06 spikes/s
- W_c,v = 0.2
- W_p,v = 0.103
- theta_v = -0.68 spikes/s

## Numerical integration

All first-order source ODEs use the exact piecewise-constant solution:

```
x(t+dt) = target + [x(t)-target] * exp(-dt/tau)
```

Pure delays use timestamped signal history with linear interpolation.

## Integration boundary

This candidate is designed to become the sole HR owner if validated.

When activated in a candidate runtime:
- circulation receives exactly one HR boundary from this controller;
- HumMod/source SA-node HR becomes diagnostic-only;
- no averaging, blending, or reconciliation occurs.

## Current authority gate

Not yet canonical.

Before cutover:
1. run source-condition tests;
2. run independent human isocapnic hypoxia;
3. run normoxic hypercapnia;
4. run combined hypoxic-hypercapnic failure;
5. test controlled ventilation with actual Vent VT;
6. test recovery;
7. confirm no second HR owner remains in the active circulation path.

The source's printed Eq. 1 O2/CO2 K function is preserved exactly, including
its branch behavior near PaO2=40 mmHg. This must be specifically examined in
external trajectory validation rather than silently smoothed.
