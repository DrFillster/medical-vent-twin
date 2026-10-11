# Ursino 1998 Closed-Loop Cardiovascular Candidate Ledger

Date: 2026-10-11
Authority: candidate only
Purpose: coherent cardiovascular plant + baroreflex ownership block

Primary source:
Mauro Ursino.
**Interaction between carotid baroregulation and the pulsating heart:
a mathematical model.**
Am J Physiol Heart Circ Physiol. 1998;275:H1733-H1747.
DOI: 10.1152/ajpheart.1998.275.5.H1733.

## Why this candidate

The current browser twin derives HR, MAP, CO, SV, resistance and filling state
from multiple reduced bridges. A digital twin is better served by a coherent
plant in which pressure, volume, flow, contractility, vascular resistance,
venous capacitance and heart period are solved together.

Ursino 1998 provides that block in one source family:
- pulsatile left and right ventricles;
- systemic and pulmonary circulation;
- baroreceptor afferent dynamics;
- sympathetic and vagal efferents;
- sympathetic control of LV/RV Emax;
- splanchnic/extrasplanchnic resistance;
- splanchnic/extrasplanchnic venous unstressed volume;
- sympathovagal heart-period control.

This candidate is also the cardiovascular foundation extended by later
Ursino/Magosso and Albanese/Cheng cardiopulmonary models.

## Authoritative equations

### Vascular plant — Eqs. 1-11

```
dP_pa/dt = (F_o,r - F_pa) / C_pa                       (1)
dF_pa/dt = (P_pa - P_pp - R_pa F_pa) / L_pa           (2)
dP_pp/dt = [F_pa - (P_pp-P_pv)/R_pp] / C_pp            (3)
dP_pv/dt = [(P_pp-P_pv)/R_pp - (P_pv-P_la)/R_pv]/C_pv (4)

dP_sa/dt = (F_o,l - F_sa) / C_sa                       (5)
dF_sa/dt = (P_sa - P_sp - R_sa F_sa) / L_sa           (6)

dP_sp/dt =
 [F_sa - (P_sp-P_sv)/R_sp - (P_sp-P_ev)/R_ep]
 / (C_sp + C_ep)                                        (7)

dP_ev/dt =
 [(P_sp-P_ev)/R_ep - (P_ev-P_ra)/R_ev - dV_u,ev/dt]
 / C_ev                                                  (8)
```

Splanchnic venous pressure is the blood-volume closure relation (Eq. 9);
Eqs. 10-11 define total unstressed volume and blood-volume change.

### Heart — Eqs. 12-29

Left atrial conservation:
```
dP_la/dt = [(P_pv-P_la)/R_pv - F_i,l] / C_la           (12)
```

Ideal AV valve:
```
F_i,l = 0                         if P_la <= P_lv
F_i,l = (P_la-P_lv)/R_la          if P_la > P_lv        (13)
```

Left ventricular volume:
```
dV_lv/dt = F_i,l - F_o,l                                (14)
```

Aortic outflow:
```
F_o,l = 0                         if P_max,lv <= P_sa
F_o,l = (P_max,lv-P_sa)/R_lv      otherwise             (15)
```

Ventricular viscous resistance:
```
R_lv = k_R,lv * P_max,lv                                (16)
P_lv = P_max,lv - R_lv * F_o,l                          (17)
```

Isometric pressure:
```
P_max,lv =
 phi(t) E_max,lv (V_lv-V_u,lv)
 + [1-phi(t)] P_0,lv [exp(k_E,lv V_lv)-1]               (18)
```

Activation:
```
phi = sin^2(pi*T*u/T_sys)  for 0 <= u <= T_sys/T
phi = 0                    otherwise                    (19)

du/dt = 1/T with u reset modulo 1                       (20-21)

T_sys = T_sys,0 - k_sys/T                               (22)
```

Right-heart Eqs. 23-29 have the same structure with right-heart parameters.

### Baroreceptor afferent — Eqs. 30-32

```
tau_p d(P_tilde)/dt
  = P_cs + tau_z d(P_cs)/dt - P_tilde                  (30)

f_cs =
 [f_min + f_max exp((P_tilde-P_n)/k_a)]
 / [1 + exp((P_tilde-P_n)/k_a)]                        (31)
```

Closed loop:
`P_cs = P_sa`.

### Efferents — Eqs. 33-34

```
f_es =
 f_es,infinity
 + (f_es,0-f_es,infinity) exp(-k_es f_cs)              (33)

f_ev =
 [f_ev,0 + f_ev,infinity exp((f_cs-f_cs,0)/k_ev)]
 / [1 + exp((f_cs-f_cs,0)/k_ev)]                       (34)
```

### Sympathetic effectors — Eqs. 35-37

```
sigma_theta(t)
 = G_theta ln[f_es(t-D_theta)-f_es,min+1]
   if delayed f_es >= f_es,min
 = 0 otherwise                                          (35)

d(Delta theta)/dt =
 [-Delta theta + sigma_theta] / tau_theta               (36)

theta = theta_0 + Delta theta                           (37)
```

Applied to:
- E_max,lv
- E_max,rv
- R_sp
- R_ep
- V_u,sv
- V_u,ev

### Heart period — Eqs. 38-42

```
sigma_T,s =
 G_T,s ln[f_es(t-D_T,s)-f_es,min+1]                    (38)

d(Delta T_s)/dt =
 [-Delta T_s + sigma_T,s]/tau_T,s                       (39)

sigma_T,v = G_T,v f_ev(t-D_T,v)                        (40)

d(Delta T_v)/dt =
 [-Delta T_v + sigma_T,v]/tau_T,v                       (41)

T = Delta T_s + Delta T_v + T_0                        (42)
```

## Primary source parameters

### Table 1 — vascular

| variable | value |
|---|---:|
| C_sa | 0.28 mL/mmHg |
| V_u,sa | 0 mL |
| R_sa | 0.06 mmHg s/mL |
| L_sa | 0.22e-3 mmHg mL s^-2 |
| C_sp | 2.05 mL/mmHg |
| V_u,sp | 274.4 mL |
| R_sp basal physical | 3.307 mmHg s/mL |
| C_ep | 1.67 mL/mmHg |
| V_u,ep | 336.6 mL |
| R_ep basal physical | 1.407 mmHg s/mL |
| C_sv | 61.11 mL/mmHg |
| V_u,sv basal physical | 1121 mL |
| R_sv | 0.038 mmHg s/mL |
| C_ev | 50.0 mL/mmHg |
| V_u,ev basal physical | 1375 mL |
| R_ev | 0.016 mmHg s/mL |
| C_pa | 0.76 mL/mmHg |
| V_u,pa | 0 mL |
| R_pa | 0.023 mmHg s/mL |
| L_pa | 0.18e-3 mmHg mL s^-2 |
| C_pp | 5.80 mL/mmHg |
| V_u,pp | 123 mL |
| R_pp | 0.0894 mmHg s/mL |
| C_pv | 25.37 mL/mmHg |
| V_u,pv | 120 mL |
| R_pv | 0.0056 mmHg s/mL |
| total blood volume | 5300 mL |

### Table 2 — heart

| variable | left | right |
|---|---:|---:|
| atrial compliance | 19.23 | 31.25 mL/mmHg |
| atrial unstressed volume | 25 | 25 mL |
| AV resistance | 2.5e-3 | 2.5e-3 mmHg s/mL |
| P0 | 1.5 | 1.5 mmHg |
| kE | 0.014 | 0.011 mL^-1 |
| ventricular unstressed volume | 16.77 | 40.8 mL |
| basal physical Emax | 2.95 | 1.75 mmHg/mL |
| kR | 3.75e-4 | 1.4e-3 s/mL |

Other:
- basal physical heart period = 0.833 s;
- T_sys,0 = 0.5 s;
- k_sys = 0.075 s^2.

### Table 3 — baroreflex/effectors

Afferent:
- P_n = 92 mmHg
- f_min = 2.52 spikes/s
- f_max = 47.78 spikes/s
- k_a = 11.758 mmHg
- tau_z = 6.37 s
- tau_p = 2.076 s

Sympathetic:
- f_es,infinity = 2.10 spikes/s
- f_es,0 = 16.11 spikes/s
- k_es = 0.0675 s
- f_es,min = 2.66 spikes/s

Vagal:
- f_ev,0 = 3.2 spikes/s
- f_ev,infinity = 6.3 spikes/s
- k_ev = 7.06 spikes/s
- f_cs,0 = 25 spikes/s

Effector denervated/baseline terms:
- Emax_lv,0 = 2.392 mmHg/mL
- Emax_rv,0 = 1.412 mmHg/mL
- R_sp,0 = 2.49 mmHg s/mL
- R_ep,0 = 0.78 mmHg s/mL
- Vu_sv,0 = 1435.4 mL
- Vu_ev,0 = 1537 mL
- T_0 = 0.58 s

Effector gains / delays / time constants:
- LV Emax: G=0.475, D=2 s, tau=8 s
- RV Emax: G=0.282, D=2 s, tau=8 s
- R_sp: G=0.695, D=2 s, tau=6 s
- R_ep: G=0.53, D=2 s, tau=6 s
- Vu_sv: G=-265.4, D=5 s, tau=20 s
- Vu_ev: G=-132.5, D=5 s, tau=20 s
- sympathetic T: G=-0.13, D=2 s, tau=2 s
- vagal T: G=0.09, D=0.2 s, tau=1.5 s

## Important distinction: physical basal values vs denervated effector offsets

Table 1/2 physical basal values and Table 3 zero-innervation offsets are not
interchangeable. The source model's resting regulated state emerges from the
neural drive acting on the Table 3 offsets.

Do not initialize the effectors by substituting Table 1/2 values into Table 3.

## Candidate scope

First candidate:
- exact plant equations;
- exact baroreflex equations;
- exact delays/effectors;
- no hypoxia/CO2 additions yet.

Second stage:
- extend the same plant with Ursino/Magosso 2000 and Magosso/Ursino 2001
  chemoreceptor/CNS terms.

This preserves same-family ownership rather than splicing a controller to an
unrelated plant.

## Validation before ownership

Reproduce:
1. Ursino basal hemodynamics;
2. pacing HR-vs-SV/CO behavior;
3. open-loop carotid sinus pressure responses;
4. acute hemorrhage response;
5. only then add hypoxia/hypercapnia extensions and validate against human data.

No canonical cutover before those tests.
