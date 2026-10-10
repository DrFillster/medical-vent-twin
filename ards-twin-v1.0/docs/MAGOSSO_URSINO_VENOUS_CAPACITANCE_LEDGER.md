# Magosso/Ursino 2001 Venous Sympathetic and Capacitance Ledger

Status: architecture and downstream effector parameters identified; **activation blocked**
Date: 2026-10-10

## Role in the evolving model

HumMod is no longer treated as the cardiovascular reference standard. The target cardiovascular pathway is a complete published-model controller + plant, with HumMod retained as a comparator and selected subsystem source where independently justified.

The 2001 Magosso/Ursino model adds a distinct venous sympathetic efferent channel, `f_sv`, separate from:
- `f_sp`: arteriolar/peripheral sympathetic activity;
- `f_sh`: cardiac sympathetic activity;
- `f_v`: cardiac vagal activity.

This distinction matters because venous capacitance/stressed volume changes affect venous return, preload, SV, CO, and MAP.

## Venous sympathetic controller

2001 Eq. 3 uses the same general sympathetic form for j = h, p, v:

```
f_sj =
  f_es,inf
  + (f_es,0 - f_es,inf)
    * exp{k_es[
      W_b,sj*f_ab +
      W_c,sj*f_ac +
      W_p,sj*f_ap -
      theta_sj
    ]}
```

with an upper sympathetic firing ceiling.

For the venous branch:
- `W_b,sv = -1`
- `W_c,sv = 5`
- `W_p,sv = -0.34`
- `theta_svn = 13.32 s^-1`
- hypoxic saturation term `chi_sv = 6 s^-1`
- `PO2_sv = 30 mmHg`
- `k_isc,sv = 2 mmHg`
- `tau_isc = 30 s`
- published 2001 `g_ccsv = 0` according to the current ledger transcription.

## Venous unstressed-volume effectors

Source-family structure:

```
sigma_Vu,j =
  G_V,j * ln(max(f_sv(t-D_V,j), f_es,min) - f_es,min + 1)

d DeltaVu_j/dt =
  (-DeltaVu_j + sigma_Vu,j) / tau_V,j

Vu_j = max(Vu_j,0 + DeltaVu_j, 0)
```

Secondary transcription parameters currently catalogued:

| Bed | Baseline Vu (mL) | Gain | Delay | Tau |
| --- | ---: | ---: | ---: | ---: |
| Extra-splanchnic | 607.8 | -74.21 | 5 s | 20 s |
| Splanchnic | 961.6 | -265.4 | 5 s | 20 s |
| Resting skeletal muscle | 190.95 | -28.29 | 5 s | 20 s |
| Active skeletal muscle | 286.4 | -28.29 | 5 s | 20 s |

The active-muscle gain is marked edited in the secondary implementation and therefore cannot be treated as primary-source authoritative.

## Why this remains fail-closed

The 2001 peripheral chemoreceptor Eq. 1 contains the O2-CO2 interaction that supplies `f_ac` to all three sympathetic branches. Its piecewise PaO2-dependent coefficient has not yet been visually verified from the primary article.

Therefore:
- do not activate `f_sv`;
- do not emit numeric venous unstressed-volume responses;
- do not use 2000 `f_ac` as an undocumented substitute for the 2001 combined O2-CO2 formulation;
- do not derive MAP/CO/SV from an incomplete venous pathway.

## Next step

Primary-source verification of Eq. 1 clears the path to:
1. full 2001 `f_sp/f_sv/f_sh` integration;
2. venous capacitance shadow activation;
3. full parallel cardiovascular plant;
4. physician-facing MAP/CO/SV/SVR predictions.
