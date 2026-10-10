# Ursino–Magosso Equation Transcription Ledger

Status: v1.5 implementation ledger
Date: 2026-10-10
Scope: Phases 1–5 of the autonomic/chemoreflex modernization program

## Governing provenance rule

All gains, transfer functions, thresholds, mappings, time constants, saturation limits, and other physiologic parameters must be explicitly derived from published medical or physiologic references. Each implemented relationship must document its source, equation or parameter basis, units, intended physiologic effect, and any transformation required to map the published model into HumMod/Vent variables.

Empirical or fitted relationships are permitted only when the fitting method, source data, rationale, and independent validation are explicitly documented. No physiologic gain or mapping may be introduced solely to produce a desired simulation response.

## Primary source A — Ursino & Magosso 2000

Mauro Ursino, Elisa Magosso. Acute cardiovascular response to isocapnic hypoxia. I. A mathematical model. Am J Physiol Heart Circ Physiol. 2000;279:H149-H165. DOI: 10.1152/ajpheart.2000.279.1.H149. PMID: 10899052.

Companion validation paper:
Mauro Ursino, Elisa Magosso. Acute cardiovascular response to isocapnic hypoxia. II. Model validation. Am J Physiol Heart Circ Physiol. 2000;279:H166-H175. DOI: 10.1152/ajpheart.2000.279.1.H166. PMID: 10899053.

### Eq. 17 — peripheral arterial chemoreceptor static response

Printed page H161.

```
phi_ac(PaO2) =
  [ f_ac,max + f_ac,min * exp((PaO2 - PO2_n)/k_ac) ]
  / [ 1 + exp((PaO2 - PO2_n)/k_ac) ]
```

Variables:
- PaO2: arterial oxygen partial pressure, mmHg.
- phi_ac: static peripheral chemoreceptor firing target, spikes/s.

Parameters from Table 2:
- f_ac,min = 1.16 spikes/s
- f_ac,max = 17.07 spikes/s
- PO2_n = 45 mmHg
- k_ac = 29.27 mmHg

Intended effect: progressive peripheral chemoreceptor activation as PaO2 falls, with saturation at severe hypoxia.

Vent/HumMod mapping:
- input: reduced-HumMod arterial PaO2, mmHg.
- output: shadow-controller f_ac target, spikes/s.
- no direct mapping to heart rate.

### Eq. 18 — peripheral chemoreceptor dynamics

Printed page H161.

```
df_ac/dt = (-f_ac + phi_ac) / tau_c
```

Parameter:
- tau_c = 2 s

Implementation: exact zero-order-hold discretization of the published first-order ODE over each simulation step. This is a numerical integration choice and adds no physiologic parameter.

### Eq. 19 — pulmonary stretch-receptor static response

Printed page H161.

```
phi_ap(VT) = G_ap * VT
```

Variables:
- VT: tidal volume, L.
- phi_ap: pulmonary stretch-receptor firing target, spikes/s.

Parameter:
- G_ap = 23.29 L^-1 * spikes/s

Project mapping:
- VT is the actual delivered Vent tidal volume in liters.
- No blood-gas surrogate for VT is permitted.
- No empirical scale factor is introduced.

### Eq. 20 — pulmonary stretch-receptor dynamics

Printed page H161.

```
df_ap/dt = (-f_ap + phi_ap) / tau_p
```

Parameter:
- tau_p = 2 s

Implementation: exact zero-order-hold discretization.

### Eq. 21 — peripheral/arteriolar sympathetic efferent activity

Printed page H162.

```
f_sp =
  f_es,infinity
  + (f_es,0 - f_es,infinity)
    * exp[k_es * (-W_b,sp*f_ab + W_c,sp*f_ac - W_p,sp*f_ap - theta_sp)]
```

The published upper limit f_es,max is applied.

Parameters from Table 2:
- f_es,infinity = 2.1 spikes/s
- f_es,0 = 16.11 spikes/s
- f_es,max = 60 spikes/s
- k_es = 0.0675 s
- W_b,sp = 1
- W_c,sp = 5
- W_p,sp = 0.34

Required input not yet mapped:
- f_ab: baroreceptor afferent firing, spikes/s.

Important: HumMod `Baroreflex.NA` has not been demonstrated to be the same physical quantity as Ursino f_ab. No conversion is permitted without an explicit source.

### Eq. 22 — cardiac sympathetic efferent activity

Printed page H162.

```
f_sh =
  f_es,infinity
  + (f_es,0 - f_es,infinity)
    * exp[k_es * (-W_b,sh*f_ab + W_c,sh*f_ac - theta_sh)]
```

Upper limit f_es,max applies.

Parameters:
- W_b,sh = 1
- W_c,sh = 1
- remaining sympathetic constants as above.

### Eq. 23 — cardiac vagal efferent activity

Printed page H162.

```
f_v =
  f_ev,0
  + [f_ev,infinity * exp((f_ab - f_ab,0)/k_ev)]
    / [1 + exp((f_ab - f_ab,0)/k_ev)]
  + W_c,v*f_ac
  - W_p,v*f_ap
  - theta_v
```

Parameters from Table 2:
- f_ev,infinity = 6.3 spikes/s
- f_ev,0 = 3.2 spikes/s
- f_ab,0 = 25 spikes/s
- k_ev = 7.06 spikes/s
- W_c,v = 0.2
- W_p,v = 0.103
- theta_v = -0.68 spikes/s

Status: equation implemented as a pure shadow function, but output is withheld unless a source-valid f_ab is supplied.

### Eqs. 24–27 — CNS hypoxia offsets

Printed page H162.

Peripheral/vascular sympathetic offset:

```
chi_sp(PaO2) =
  [chi_min,sp + chi_max,sp * exp((PaO2 - PO2_n,sp)/k_isc,sp)]
  / [1 + exp((PaO2 - PO2_n,sp)/k_isc,sp)]

dtheta_sp/dt = (-theta_sp + chi_sp) / tau_isc
```

Cardiac sympathetic offset:

```
chi_sh(PaO2) =
  [chi_min,sh + chi_max,sh * exp((PaO2 - PO2_n,sh)/k_isc,sh)]
  / [1 + exp((PaO2 - PO2_n,sh)/k_isc,sh)]

dtheta_sh/dt = (-theta_sh + chi_sh) / tau_isc
```

Parameters from Table 2:
- chi_max,sp = 13.32 spikes/s
- chi_min,sp = 7.33 spikes/s
- PO2_n,sp = 30 mmHg
- k_isc,sp = 2 mmHg
- chi_max,sh = 3.59 spikes/s
- chi_min,sh = -49.38 spikes/s
- PO2_n,sh = 45 mmHg
- k_isc,sh = 6 mmHg
- tau_isc = 30 s

Project mapping:
- PaO2 remains the published independent variable.
- theta_sp and theta_sh remain distinct state variables.
- no collapse into a single generic “hypoxia gain.”

## Primary source B — Magosso & Ursino 2001

Elisa Magosso, Mauro Ursino. A mathematical model of CO2 effect on cardiovascular regulation. Am J Physiol Heart Circ Physiol. 2001;281:H2036-H2052. DOI: 10.1152/ajpheart.2001.281.5.H2036. PMID: 11668065.

The 2001 model adds:
- O2-CO2 interaction at peripheral chemoreceptors;
- distinct cardiac, arteriolar, and venous sympathetic channels;
- direct CNS CO2 effects;
- local tissue O2/CO2 vascular effects;
- central and peripheral ventilatory responses.

### Eq. 2 — peripheral chemoreceptor dynamics

```
df_ac/dt = (-f_ac + phi_ac) / tau_ac
```

Table 1:
- tau_ac = 2 s
- f_ac,max = 12.3 s^-1
- f_ac,min = 0.835 s^-1
- PtildeO2_ac = 45 mmHg
- k_ac = 29.27 mmHg
- K_H = 3
- f = 1.4

### Eq. 3 — sympathetic efferent channels

For j = h, p, v:

```
f_sj =
  f_es,infinity
  + (f_es,0 - f_es,infinity)
    * exp{k_es [W_b,sj*f_ab + W_c,sj*f_ac + W_p,sj*f_ap - theta_sj]}
```

with f_es,max ceiling.

Table 1:
- f_es,infinity = 2.10 s^-1
- f_es,0 = 16.11 s^-1
- f_es,max = 60 s^-1
- k_es = 0.0675 s
- W_b,sp = -1
- W_b,sv = -1
- W_b,sh = -1
- W_c,sp = 5
- W_c,sv = 5
- W_c,sh = 1
- W_p,sp = -0.34
- W_p,sv = -0.34
- W_p,sh = 0

This is algebraically consistent with the 2000 sign convention when the signed weights are retained exactly.

### Eqs. 4–7 — CNS O2 and CO2 terms

```
omega_sj(PaO2) = chi_sj / [1 + exp((PaO2 - PtildeO2_sj)/k_isc,sj)]

d(Delta theta_O2,sj)/dt =
  (-Delta theta_O2,sj + omega_sj) / tau_isc

d(Delta theta_CO2,sj)/dt =
  [-Delta theta_CO2,sj + g_ccsj*(PaCO2 - PaCO2_n)] / tau_cc

theta_sj =
  theta_sjn - Delta theta_O2,sj - Delta theta_CO2,sj
```

Table 1:
- chi_sp = 6 s^-1
- PtildeO2_sp = 30 mmHg
- k_isc,sp = 2 mmHg
- chi_sv = 6 s^-1
- PtildeO2_sv = 30 mmHg
- k_isc,sv = 2 mmHg
- chi_sh = 53 s^-1
- PtildeO2_sh = 45 mmHg
- k_isc,sh = 6 mmHg
- tau_isc = 30 s
- g_ccsp = 1.5 mmHg^-1 s^-1
- g_ccsv = 0
- g_ccsh = 1 mmHg^-1 s^-1
- PaCO2_n = 40 mmHg
- tau_cc = 20 s
- theta_spn = 13.32 s^-1
- theta_svn = 13.32 s^-1
- theta_shn = 3.6 s^-1

### Eqs. 16–20 — ventilation branch

```
Vdot = Vdot_n + DeltaVdot_p + DeltaVdot_c

d(DeltaVdot_p)/dt =
  {-DeltaVdot_p + g_Vp[f_ac(t-D_Vp)-f_ac,n]} / tau_Vp

d(DeltaVdot_c)/dt =
  {-DeltaVdot_c + g_Vc[PaCO2(t-D_Vc)-PaCO2_n]} / tau_Vc

VT = 0.15*(Vdot + 1)^0.65

RR = Vdot / VT
```

Table 1:
- Vdot_n = 7 L/min
- f_ac,n = 3.6 s^-1
- PaCO2_n = 40 mmHg
- g_Vp = 3.6 L/min*s
- D_Vp = 7 s
- tau_Vp = 13 s
- g_Vch = 1.8 L/min/mmHg
- D_Vc = 8 s
- tau_Vc = 180 s
- g_Vcl = 0.12 L/min/mmHg

Project ownership decision:
- these equations remain audit/reference equations for now;
- Vent owns actual delivered VT and ventilator mechanics;
- respiratory neural-drive ownership will be reconciled later with Hennigs et al.

## Hard provenance blockers identified

### 1. 2001 Eq. 1 O2-CO2 peripheral interaction

The article’s Eq. 1 contains a PaO2-dependent piecewise coefficient K multiplying the logarithmic PaCO2 term. The available text extraction is not sufficiently reliable to guarantee every inequality/sign in that piecewise K definition.

Status: **DO NOT IMPLEMENT YET.**

Requirement to clear:
- visually verify the printed Eq. 1 and piecewise K definition from the primary article/PDF;
- transcribe it verbatim into this ledger;
- independently review the transcription before activation.

### 2. Ursino f_ab -> HumMod mapping

Ursino f_ab is baroreceptor afferent firing in spikes/s. Current HumMod instrumentation exposes `Baroreflex.NA`, but no source-backed equivalence or conversion has been established.

Status: **NO MAPPING.**

Consequences:
- f_ac, f_ap, theta_sp, and theta_sh can run in shadow mode.
- f_sp, f_sh, and f_v equations are implemented as pure functions but are not evaluated from HumMod `Baroreflex.NA`.
- no surrogate or fitted conversion is allowed.

## v1.5 implementation status

- Step 1 equation ledger: complete.
- Step 2 exact equation/parameter/unit/page transcription: complete for the 2000 Phase 1–4 equations; 2001 audit complete with Eq. 1 explicitly blocked pending visual verification.
- Step 3 Phase 1–3 shadow module: implemented; efferent outputs gated on source-valid f_ab.
- Step 4 lung-stretch coupling: implemented in shadow mode using actual Vent tidal volume in liters.
- Step 5 CO2 parameter audit: complete; no CO2 control path is activated until Eq. 1 transcription blocker is cleared.
