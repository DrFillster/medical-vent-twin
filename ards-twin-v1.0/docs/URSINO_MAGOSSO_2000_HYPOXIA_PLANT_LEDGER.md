# Ursino-Magosso 2000 Hypoxia Plant Source Ledger

Date: 2026-10-11
Status: source-completion plan; no canonical authority
Primary source: Ursino M, Magosso E. Acute cardiovascular response to isocapnic hypoxia. I. A mathematical model. Am J Physiol Heart Circ Physiol. 2000;279:H149-H165. DOI: 10.1152/ajpheart.2000.279.1.H149.

## Architecture rule

Do not mutate the source-reproduced Ursino 1998 hemorrhage candidate into a hybrid.

Build a separate Ursino-Magosso 2000 hypoxia plant candidate because the 2000 source changes the systemic circulation topology and adds local oxygen-dependent vascular control.

Systemic arterial outflow is distributed across five parallel systemic beds:
- splanchnic (s);
- remaining extrasplanchnic / nonautoregulated (e);
- skeletal muscle (m);
- cerebral (b);
- coronary / heart (h).

Brain and coronary resistance/venous unstressed volume are not reflex neural effectors in this model. They are dominated by local metabolic regulation.

Skeletal-muscle peripheral resistance has both sympathetic and local O2 control.

## Primary Table 1 — vascular basal parameters

All values below are direct primary-source values.

### Large systemic artery
- C_sa = 0.28 mL/mmHg
- Vu_sa = 0 mL
- R_sa = 0.06 mmHg*s/mL
- L_sa = 0.22e-3 mmHg*s^2/mL

### Splanchnic
- C_sp = 2.05 mL/mmHg
- Vu_sp = 274.4 mL
- R_sp = 3.307 mmHg*s/mL
- C_sv = 61.11 mL/mmHg
- Vu_sv = 1121 mL
- R_sv = 0.038 mmHg*s/mL

### Remaining extrasplanchnic
- C_ep = 0.668 mL/mmHg
- Vu_ep = 134.64 mL
- R_ep = 3.52 mmHg*s/mL
- C_ev = 20 mL/mmHg
- Vu_ev = 550 mL
- R_ev = 0.04 mmHg*s/mL

### Skeletal muscle
- C_mp = 0.525 mL/mmHg
- Vu_mp = 105.8 mL
- R_mp = 4.48 mmHg*s/mL
- C_mv = 15.71 mL/mmHg
- Vu_mv = 432.14 mL
- R_mv = 0.05 mmHg*s/mL

### Cerebral
- C_bp = 0.358 mL/mmHg
- Vu_bp = 72.13 mL
- R_bp = 6.57 mmHg*s/mL
- C_bv = 10.71 mL/mmHg
- Vu_bv = 294.64 mL
- R_bv = 0.075 mmHg*s/mL

### Coronary
- C_hp = 0.119 mL/mmHg
- Vu_hp = 24 mL
- R_hp = 19.71 mmHg*s/mL
- C_hv = 3.57 mL/mmHg
- Vu_hv = 98.21 mL
- R_hv = 0.224 mmHg*s/mL

### Pulmonary
- C_pa = 0.76 mL/mmHg
- Vu_pa = 0 mL
- R_pa = 0.023 mmHg*s/mL
- L_pa = 0.18e-3 mmHg*s^2/mL
- C_pp = 5.80 mL/mmHg
- Vu_pp = 123 mL
- R_pp = 0.0894 mmHg*s/mL
- C_pv = 25.37 mL/mmHg
- Vu_pv = 120 mL
- R_pv = 0.0056 mmHg*s/mL
- total blood volume = 5300 mL

## Primary Table 2 — reflex and ventilatory parameters

### Baroreceptor
- tau_z,b = 6.37 s
- tau_p,b = 2.076 s
- f_ab,min = 2.52 spikes/s
- f_ab,max = 47.78 spikes/s
- P_n = 92 mmHg
- k_ab = 11.76 mmHg

### Peripheral chemoreceptor
- tau_c = 2 s
- f_ac,min = 1.16 spikes/s
- f_ac,max = 17.07 spikes/s
- PO2 midpoint = 45 mmHg
- k_ac = 29.27 mmHg

### Pulmonary stretch
- tau_p = 2 s
- G_ap = 23.29 L^-1 * spikes/s

### Sympathetic integration
- f_es,infinity = 2.1 spikes/s
- f_es,0 = 16.11 spikes/s
- f_es,min = 2.66 spikes/s
- f_es,max = 60 spikes/s
- k_es = 0.0675 s
- W_b,sp = 1
- W_c,sp = 5
- W_p,sp = 0.34
- W_b,sh = 1
- W_c,sh = 1

### Vagal integration
- f_ev,infinity = 6.3 spikes/s
- f_ev,0 = 3.2 spikes/s
- f_ab,0 = 25 spikes/s
- k_ev = 7.06 spikes/s
- W_c,v = 0.2
- W_p,v = 0.103
- theta_v = -0.68 spikes/s

### CNS hypoxia
Peripheral sympathetic offset:
- chi_max,sp = 13.32 spikes/s
- chi_min,sp = 7.33 spikes/s
- PO2 midpoint sp = 30 mmHg
- k_isc,sp = 2 mmHg

Cardiac sympathetic offset:
- chi_max,sh = 3.59 spikes/s
- chi_min,sh = -49.38 spikes/s
- PO2 midpoint sh = 45 mmHg
- k_isc,sh = 6 mmHg

Common:
- tau_isc = 30 s

### Ventilatory response — Eqs. 28-29
- gain = 0.125 L per neural-rate unit
- tau = 3 s
- delay = 6 s
- basal VT = 0.583 L
- basal f_ac = 3.6 spikes/s

### Reflex effectors — Eqs. 30-40
LV Emax:
- gain 0.475 mmHg/mL per neural-rate unit
- tau 8 s
- delay 2 s
- offset 2.392 mmHg/mL

RV Emax:
- gain 0.282
- tau 8 s
- delay 2 s
- offset 1.412 mmHg/mL

Splanchnic resistance:
- gain 0.695
- tau 6 s
- delay 2 s
- offset 2.49 mmHg*s/mL

Remaining extrasplanchnic resistance:
- gain 1.94
- tau 6 s
- delay 2 s
- offset 1.655 mmHg*s/mL

Skeletal-muscle resistance:
- gain 2.47
- tau 6 s
- delay 2 s
- offset 2.106 mmHg*s/mL

Splanchnic venous unstressed volume:
- gain -265.4 mL per neural-rate unit
- tau 20 s
- delay 5 s
- offset 1435.4 mL

Remaining extrasplanchnic venous unstressed volume:
- gain -74.21
- tau 20 s
- delay 5 s
- offset 640.73 mL

Skeletal-muscle venous unstressed volume:
- gain -58.29
- tau 20 s
- delay 5 s
- offset 503.26 mL

Heart period:
- sympathetic gain -0.13 s per neural-rate unit
- sympathetic tau 2 s
- sympathetic delay 2 s
- basal T0 = 0.58 s
- vagal gain 0.09 s per neural-rate unit
- vagal tau 1.5 s
- vagal delay 0.2 s

## Primary Table 3 — local O2 regulation

### Skeletal muscle
- normal venous O2 concentration = 0.155
- O2 consumption = 0.86 mL/s
- gain = 30
- tau = 10 s

### Brain
- normal venous O2 concentration = 0.14
- O2 consumption = 0.7917 mL/s
- gain = 10
- tau = 10 s

### Coronary
- normal venous O2 concentration = 0.11
- normal O2 consumption = 0.4 mL/s
- gain = 35
- tau = 10 s
- normal cardiac work W_h,n = 12660 mmHg*mL/s
- cardiac-work tau = 5 s

### O2 dissociation parameters used by source
- C = 9 mmol/L
- a = 0.3836
- alpha = 0.03198 mmHg^-1
- beta = 0.008275 mmHg^-1
- K = 14.99 mmHg

## Source dynamic target — Fig. 11

Protocol:
- initial PaO2 = 95 mmHg;
- PaO2 decreases from 95 to 28 mmHg over 10 s;
- PaCO2 remains constant;
- deep hypoxia is then maintained.

Expected qualitative trajectory:
- early 8-10 s: moderate mean SAP increase, HR decrease, approximately constant CO, flow redistributed toward high-metabolic-demand organs;
- later phase after lung-stretch and CNS hypoxia engage: HR and CO rise together; flow recovers toward lower-metabolic-demand beds;
- within roughly 1 min, mean SAP and HR are above baseline.

## Build order

1. Create a separate 2000 vascular state vector and mass-balance runtime.
2. Reuse the unchanged 1998 heart equations where the source explicitly says heart mechanics are unchanged.
3. Use 2000-specific reflex effector parameters, not 1998 extrasplanchnic substitutions.
4. Add local O2 states separately for muscle, brain, and coronary resistance.
5. Add source oxygen extraction/content equations only after exact primary equations are transcribed.
6. Reproduce Fig. 11 source dynamics before comparing to independent human data.
7. Keep this candidate separate from bedside canonical state.
8. In bedside controlled ventilation, Vent remains owner of delivered VT.

## Do not do

- Do not tune HR directly.
- Do not reuse 1998 Rep/Vuev parameters for the 2000 plant.
- Do not collapse brain/coronary/muscle into the old extrasplanchnic bed.
- Do not apply the spontaneous source VT controller to mechanically ventilated bedside mode.
- Do not claim full 2000 reproduction until the local-O2 equations and regional vascular mass balances are source-complete.
