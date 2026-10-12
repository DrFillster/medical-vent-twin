# Magosso–Ursino 2001 CO2 Parameter Audit

Status: primary Eq. 1 transcription recovered; candidate implementation permitted; authority still blocked pending external validation
Date: 2026-10-10
Source: Magosso E, Ursino M. A mathematical model of CO2 effect on cardiovascular regulation. Am J Physiol Heart Circ Physiol. 2001;281:H2036-H2052. DOI: 10.1152/ajpheart.2001.281.5.H2036. PMID: 11668065.

## Audit conclusion

The paper supports four distinct CO2-related mechanisms that must remain separate in code:

1. O2-CO2 interaction at the peripheral chemoreceptor.
2. Direct CNS CO2 modification of sympathetic control.
3. Local tissue CO2 modification of vascular resistance.
4. Central/peripheral chemoreceptor control of ventilation.

No direct PaCO2-to-heart-rate gain is supported by this model.

## Verified Table 1 parameter set

### Peripheral chemoreceptor
- f_ac,max = 12.3 s^-1
- f_ac,min = 0.835 s^-1
- PtildeO2_ac = 45 mmHg
- k_ac = 29.27 mmHg
- K_H = 3
- f = 1.4
- tau_ac = 2 s

### Sympathetic integration
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

### CNS O2/CO2
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

### Local vascular O2/CO2 branch
- G_bpn = 0.15 ml/(mmHg*s)
- C_vb,O2n = 0.14
- g_b,O2 = 10
- A = 20.9
- B = 92.8
- C = 10570
- D = -5.251
- R_hpn = 19.71 (mmHg*s)/ml
- C_vh,O2n = 0.11
- g_h,O2 = 35
- k_h,CO2 = 11.11 mmHg
- R_mpn = 4.48 (mmHg*s)/ml
- C_vm,O2n = 0.155
- g_m,O2 = 30
- k_m,CO2 = 142.8 mmHg
- tau_O2 = 10 s
- tau_CO2 = 20 s

### Ventilation branch
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

## Equation status

- Eq. 1 peripheral O2-CO2 static response: primary Appendix transcription recovered from the published article and independently cross-checked against later implementations. The printed piecewise K function is preserved exactly, including its unusual branch behavior near PaO2=40 mmHg. This clears transcription for **candidate/shadow implementation only**, not physiologic authority.
- Eq. 2 peripheral chemoreceptor dynamics: verified.
- Eq. 3 sympathetic integration: verified.
- Eqs. 4–7 CNS O2/CO2: verified.
- Eqs. 8-15 local O2/CO2 vascular regulation: primary equations and Table 1 parameters transcribed. Candidate implementation is **not yet authorized** because the equations require distinct brain, coronary, and skeletal-muscle beds plus source-valid venous O2 concentration states.
- Eqs. 16–20 ventilation: transcribed for reference; not authoritative because Vent currently owns delivered ventilation.

## Implementation rule

This audit does not authorize canonical patient-state control. Candidate/shadow implementation is permitted because the primary equation and parameters are now transcribed. Canonical authority still requires:
- all code variables to retain explicit units;
- source-valid baroreceptor afferent input in spikes/s;
- a single selected owner for each downstream canonical variable;
- isolated hypercapnia, hypoxia, combined hypoxic-hypercapnia, controlled-ventilation, and recovery validation against independent physiology;
- no blending with HumMod merely to obtain agreement.


## Primary local vascular equations recovered — Eqs. 8-15

These equations are now transcribed from the primary 2001 article. They must not be collapsed into a scalar applied to the aggregate 1998 systemic resistance.

### Cerebral bed — Eqs. 8-11

O2 and CO2 mechanisms act additively on cerebral conductance:

```
G_bp = G_bpn * (1 + x_b,O2 + x_b,CO2)
```

```
dx_b,O2/dt =
  [-x_b,O2 - g_b,O2*(C_vb,O2 - C_vb,O2n)] / tau_O2
```

```
Phi_b(PaCO2) =
  [A + B/(1 + C*exp(D*ln(PaCO2)))]
  / [A + B/(1 + C*exp(D*ln(PaCO2_n)))]
  - 1
```

```
dx_b,CO2/dt = [-x_b,CO2 + Phi_b(PaCO2)] / tau_CO2
```

Source parameters:
- G_bpn = 0.15 mL/(mmHg*s)
- C_vb,O2n = 0.14
- g_b,O2 = 10
- A = 20.9
- B = 92.8
- C = 10570
- D = -5.251
- tau_O2 = 10 s
- tau_CO2 = 20 s
- PaCO2_n = 40 mmHg

### Coronary and skeletal-muscle beds — Eqs. 12-15

For j = h (heart/coronary) or m (skeletal muscle):

```
R_jp = R_jpn * (1 + x_j,CO2) / (1 + x_j,O2)
```

```
dx_j,O2/dt =
  [-x_j,O2 - g_j,O2*(C_vj,O2 - C_vj,O2n)] / tau_O2
```

```
Phi_j(PaCO2) =
  [1 - exp((PaCO2-PaCO2_n)/k_j,CO2)]
  / [1 + exp((PaCO2-PaCO2_n)/k_j,CO2)]
```

```
dx_j,CO2/dt = [-x_j,CO2 + Phi_j(PaCO2)] / tau_CO2
```

Heart/coronary parameters:
- R_hpn = 19.71 (mmHg*s)/mL
- C_vh,O2n = 0.11
- g_h,O2 = 35
- k_h,CO2 = 11.11 mmHg

Skeletal-muscle parameters:
- R_mpn = 4.48 (mmHg*s)/mL
- C_vm,O2n = 0.155
- g_m,O2 = 30
- k_m,CO2 = 142.8 mmHg

### Integration blocker

The equations are source-complete, but the current 1998 cardiovascular candidate has only aggregate systemic beds.

Before Eqs. 8-15 can affect candidate hemodynamics, the project must source and implement:
1. distinct cerebral, coronary, and skeletal-muscle vascular compartments;
2. their source arterial/venous resistances, compliances, and unstressed volumes;
3. source mass-balance equations for those beds;
4. source-valid C_vb,O2, C_vh,O2, and C_vm,O2 states.

Do not:
- apply Eqs. 8-15 as a multiplier on aggregate Rsp/Rep;
- infer venous O2 concentrations from arbitrary extraction fractions;
- change sympathetic gains to compensate for the current high-pressure combined-gas response.
