# Magosso-Ursino 2001 CO2 Autonomic Candidate Ledger

Date: 2026-10-11
Authority: candidate only; not canonical patient owner

Primary source:
Elisa Magosso, Mauro Ursino. A mathematical model of CO2 effect on cardiovascular
regulation. Am J Physiol Heart Circ Physiol. 2001;281:H2036-H2052.
DOI: 10.1152/ajpheart.2001.281.5.H2036. PMID: 11668065.

## Eq. 1 — combined peripheral O2/CO2 chemoreceptor

The primary article Appendix defines:

```
phi_ac(PaO2, PaCO2)
 =
 [ f_ac,max + f_ac,min * exp((PaO2-PtildeO2_ac)/k_ac) ]
 / [ 1 + exp((PaO2-PtildeO2_ac)/k_ac) ]
 *
 [ K * ln(PaCO2/PaCO2_n) + f ]
```

with:

```
K = K_H                                      if PaO2 > 80
K = K_H - 1.2 * ((PaO2 - 80)/30)           if 40 < PaO2 < 80
K = K_H - 1.6                                if PaO2 < 40
```

A later integrative implementation reproducing the Magosso/Ursino pathway
uses the middle branch inclusively at the 40/80 boundaries. The candidate code
uses that deterministic boundary convention while preserving the printed
branch values exactly.

Important source behavior:
- the printed expression is discontinuous at the 40-mmHg branch boundary;
- this implementation preserves that source behavior rather than silently
  smoothing or correcting it;
- this is one reason the candidate remains non-authoritative pending external
  trajectory validation.

Parameters from Table 1:
- f_ac,max = 12.3 s^-1
- f_ac,min = 0.835 s^-1
- PtildeO2_ac = 45 mmHg
- k_ac = 29.27 mmHg
- K_H = 3
- f = 1.4
- PaCO2_n = 40 mmHg
- tau_ac = 2 s

## Eq. 2 — chemoreceptor dynamics

```
df_ac/dt = (-f_ac + phi_ac) / tau_ac
```

The implementation uses the exact first-order solution over each piecewise
constant simulator step.

## Eq. 3 — sympathetic efferent activity

For j = p (arteriolar), v (venous), h (cardiac):

```
f_sj =
 min[
  f_es,infinity
  + (f_es,0-f_es,infinity)
    * exp{
      k_es * (
        W_b,sj*f_ab
        + W_c,sj*f_ac
        + W_p,sj*f_ap
        - theta_sj
      )
    },
  f_es,max
 ]
```

Table 1:
- f_es,infinity = 2.10 s^-1
- f_es,0 = 16.11 s^-1
- f_es,max = 60 s^-1
- k_es = 0.0675 s

Signed weights:
- W_b,sp = W_b,sv = W_b,sh = -1
- W_c,sp = W_c,sv = 5
- W_c,sh = 1
- W_p,sp = W_p,sv = -0.34
- W_p,sh = 0

## Eqs. 4-7 — direct CNS O2/CO2 offsets

For j = p, v, h:

```
omega_sj(PaO2)
 = chi_sj / [1 + exp((PaO2-PtildeO2_sj)/k_isc,sj)]
```

```
d(Delta theta_O2,sj)/dt
 = (-Delta theta_O2,sj + omega_sj) / tau_isc
```

```
d(Delta theta_CO2,sj)/dt
 = [-Delta theta_CO2,sj
    + g_ccsj*(PaCO2-PaCO2_n)] / tau_cc
```

```
theta_sj
 = theta_sjn
   - Delta theta_O2,sj
   - Delta theta_CO2,sj
```

Parameters:
- tau_isc = 30 s
- tau_cc = 20 s
- PaCO2_n = 40 mmHg

Arteriolar:
- chi_sp = 6 s^-1
- PtildeO2_sp = 30 mmHg
- k_isc,sp = 2 mmHg
- g_ccsp = 1.5 mmHg^-1 s^-1
- theta_spn = 13.32 s^-1

Venous:
- chi_sv = 6 s^-1
- PtildeO2_sv = 30 mmHg
- k_isc,sv = 2 mmHg
- g_ccsv = 0
- theta_svn = 13.32 s^-1

Cardiac:
- chi_sh = 53 s^-1
- PtildeO2_sh = 45 mmHg
- k_isc,sh = 6 mmHg
- g_ccsh = 1 mmHg^-1 s^-1
- theta_shn = 3.6 s^-1

## Inputs

- PaO2, mmHg
- PaCO2, mmHg
- f_ab, baroreceptor afferent firing, spikes/s
- f_ap, lung-stretch afferent firing, spikes/s

No HumMod internal scalar is converted to f_ab. The existing Ursino baroreceptor
candidate supplies f_ab directly in spikes/s from arterial pressure.

## Outputs

- f_ac peripheral chemoreceptor firing
- theta_sp, theta_sv, theta_sh
- f_sp arteriolar sympathetic firing
- f_sv venous sympathetic firing
- f_sh cardiac sympathetic firing

Cardiac vagal activity remains a separate published pathway.

## Intended integration

For a candidate canonical HR pathway:

arterial pressure -> Ursino baroreceptor -> f_ab

PaO2 + PaCO2 -> Magosso/Ursino chemoreceptor -> f_ac

actual Vent VT -> lung stretch -> f_ap

PaO2 + PaCO2 -> CNS offsets

f_ab + f_ac + f_ap + offsets -> f_sh / f_sp / f_sv

f_sh + f_v -> Iwamoto/Ursino heart-period effector -> one candidate HR

This does not require or seek agreement with HumMod.

## Validation gate

Do not grant patient-state authority until the complete chain reproduces
independent human/experimental trajectories for:
- isocapnic hypoxia;
- normoxic hypercapnia;
- combined hypoxic hypercapnia;
- controlled ventilation;
- recovery.
