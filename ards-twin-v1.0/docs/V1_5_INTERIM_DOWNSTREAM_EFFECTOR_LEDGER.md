# v1.5 Interim Downstream Cardiovascular Effector Ledger

Date: 2026-10-10
Status: active engineering work toward physician-facing interim comparison
Control authority: none

## Publication requirement

The interim physician model cannot be published until both pathways expose:

- HR
- MAP
- CO
- SV
- SVR

at the same simulated patient time.

## Heart period

An interim counterfactual HR pathway is now implemented from the Ursino/Magosso heart-period structure.

Status:
- visible in physician comparison;
- counterfactual only;
- secondary transcription;
- primary-paper parameter verification still required before authority.

## Resistance effectors

The Ursino-family model acts on multiple systemic vascular beds rather than a single SVR scalar.

Secondary-transcribed structure:

```
sigma_Rj =
  G_Rj * ln(max(f_sp(t-D_Rj), f_es,min) - f_es,min + 1)

d DeltaR_j / dt =
  (-DeltaR_j + sigma_Rj) / tau_Rj

R_j = R_j,0 + DeltaR_j
```

Current shadow beds:
- extrasplanchnic;
- splanchnic;
- resting skeletal muscle;
- active skeletal muscle.

These are implemented in `src/ursino_downstream_effectors_shadow.js`.

**No lumped SVR is calculated yet.**

Reason: converting these parallel regional resistances into one systemic SVR requires the correct source circulation topology, local vascular modifiers, and organ flows. A direct `f_sp -> SVR` scaling would violate the provenance rule.

## Cardiac contractility

Secondary-transcribed structure:

```
sigma_Emax =
  G_Emax * ln(max(f_sh(t-D_Emax), f_es,min) - f_es,min + 1)

d DeltaEmax / dt =
  (-DeltaEmax + sigma_Emax) / tau_Emax

Emax = Emax,0 + DeltaEmax
```

Separate LV and RV elastance states are now available in shadow mode.

These states are **not yet used to generate shadow SV or CO** because doing so requires a parallel source-family ventricular/circulatory plant rather than applying an arbitrary multiplier to the existing HumMod pump.

## Venous unstressed volume

The Ursino-family circulation also changes regional venous unstressed volumes through a distinct venous sympathetic channel.

This remains the critical downstream dependency for a faithful MAP/CO response because venous capacitance substantially affects stressed volume and venous return. Ursino 1998 specifically identifies venous unstressed-volume control as an important contributor to early hemodynamic responses.

Current status:
- equation family identified;
- secondary parameter table identified;
- not integrated until the distinct venous sympathetic `f_sv` branch and its O2/CO2 provenance are reconciled.

## Why MAP/CO/SV/SVR still show “Not source-complete”

They are downstream emergent variables, not simple autonomic gains.

To calculate them honestly we need:

```
f_sp / f_sv / f_sh
      |
      +--> regional arterial resistance
      +--> regional venous unstressed volume
      +--> LV/RV Emax
      +--> heart period
               |
               v
      parallel shadow circulation
               |
               +--> SV
               +--> CO
               +--> MAP
               +--> derived SVR
```

That parallel circulation is the next implementation target.
