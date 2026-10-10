# Magosso–Ursino 2001 CO2 Parameter Audit

Status: completed parameter audit; activation blocked where noted
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

- Eq. 1 peripheral O2-CO2 static response: **BLOCKED** pending visual verification of the printed piecewise K definition.
- Eq. 2 peripheral chemoreceptor dynamics: verified.
- Eq. 3 sympathetic integration: verified.
- Eqs. 4–7 CNS O2/CO2: verified.
- Local O2/CO2 vascular equations: parameter set transcribed; not activated in v1.5.
- Eqs. 16–20 ventilation: transcribed for reference; not authoritative because Vent currently owns delivered ventilation.

## Implementation rule

This audit does not authorize activation. A CO2 controller can move from audit-only to shadow mode only after:
- Eq. 1 is visually transcribed and independently checked;
- all code variables have explicit units;
- f_ab has a source-valid mapping;
- ownership conflicts with Vent/Hennigs respiratory control are resolved;
- isolated hypercapnia and combined hypoxic-hypercapnic validation tests exist.
