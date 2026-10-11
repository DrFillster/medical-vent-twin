# Audit of Public Albanese/Cheng Cardiopulmonary MATLAB Port

Date: 2026-10-11
Status: translation aid only; **not an authoritative executable**

Repository:
`DavidRConnell/An-integrated-mathematical-model-of-the-human-cardiopulmonary-system`

Pinned source-code commit:
`ad2c978da057b6dcc415e8d9a48dc2a7ec2c1df8`

Pinned `integratedModel.m` blob:
`7a7e54dd0acab14d57d7a5d4a6940871546137a7`

Claimed lineage:
- Albanese A, Cheng L, Ursino M, Chbat NW. 2016 model development.
- Cheng L, Albanese A, Ursino M, Chbat NW. 2016 validation.

## Decision

Do not import or promote this repository wholesale.

Use it only to:
- cross-check variable naming;
- locate likely equation groupings;
- compare a new primary-source transcription;
- identify implementation traps.

The primary journal articles remain authoritative.

## Material findings

### 1. Respiratory control is not implemented

The file contains:

```matlab
if length(ic) > 1000 % For respiratory control. Not implemented.
```

The active model state never approaches that size, so the respiratory-control
branch is unreachable and fixed respiratory drive is used instead.

This means the public code is not a complete executable reproduction of the
published closed-loop CP Model validated under hypoxia and hypercapnia.

### 2. Primary Ursino Eq. 30 is mistranscribed

Ursino 1998 Eq. 30 is:

```
tau_p * d(P_tilde)/dt
  = P_cs + tau_z * d(P_cs)/dt - P_tilde
```

In closed loop, `P_cs = P_sa`.

The public MATLAB port implements:

```matlab
dPtilda = (Psa - Ptilda)/cs.tauP;
```

The source `tau_z * dPsa/dt` term is absent.

That is physiologically important because the rate-sensitive component is the
mechanism by which arterial-pressure pulsatility influences baroreceptor
afferent activity.

### 3. Filtered baroreceptor pressure initialization is suspect

The public port initializes:

```matlab
ic(1) = 9; % Ptilda
```

where the source central pressure `P_n` is 92 mmHg and the model systemic
arterial initial pressure is 120 mmHg.

No source provenance for 9 mmHg was found. It must not be inherited.

### 4. Public port is partial even where equations are recognizable

The port does contain recognizable transcriptions of:
- Ursino 1998 cardiovascular Eqs. 1-29;
- baroreflex Eqs. 30-42;
- portions of respiratory mechanics and gas exchange.

That makes it useful as a translation check, but not as the authority for
equations or parameter values.

## Governing rule

For the next cardiovascular candidate:
1. equations come from the primary Ursino / Albanese / Cheng papers;
2. source parameter tables are transcribed explicitly;
3. the public MATLAB implementation is used only as a differential-review aid;
4. any disagreement is resolved in favor of the primary paper unless an
   erratum or later authoritative source establishes otherwise.
