# Pulmonary Vascular Candidate Equation Ledger

Date: 2026-10-11
Candidate: Karamolegkos / Albanese human pulmonary circulation
Authority: **candidate only; not yet canonical patient owner**

## Why this candidate

The current reduced Vent-to-gas adapter converts a fixed compartment
`perfusionFraction * recruitment` directly into ventilated pulmonary flow.
That is an engineering bridge and does not model pulmonary vascular pressure,
alveolar-capillary compression, or regional pulmonary vascular regulation.

The first replacement candidate is the human cardiopulmonary pulmonary
circulation described by:

Nikolaos Karamolegkos, Antonio Albanese, Nicolas W. Chbat.
**Heart-Lung Interactions During Mechanical Ventilation: Analysis via a
Cardiopulmonary Simulation Model.** IEEE Open Journal of Engineering in
Medicine and Biology. 2021;2:324-341.
DOI: 10.1109/OJEMB.2021.3128629. PMCID: PMC8975239.

The paper extends the Albanese/Cheng/Ursino/Chbat cardiopulmonary model and
specifically validates mechanical heart-lung interactions during positive
pressure ventilation.

## Source topology

Four dynamic pressure nodes:
- pulmonary artery: `P_pa`
- pulmonary arteriole: `P_pal`
- pulmonary capillary: `P_pc`
- pulmonary vein: `P_pv`

The pulmonary arteriolar compartment is referenced to pleural pressure
`P_pl`. The pulmonary capillary compartment is referenced to alveolar
pressure `P_A`. This allows lung inflation to compress gas-exchanging
capillaries and alter RV afterload.

A parallel shunt originates at the arteriolar pressure node.

## Exact Appendix equations

The implementation uses the following source equations without changing their
mathematical form.

### A4
```
C_pa * d(P_pa - P_pl)/dt = Q_rv,o - Q_pa
```

### A5
```
V_pa = C_pa * (P_pa - P_pl) + V_u,pa
```

### A6
```
L_pa * dQ_pa/dt = P_pa - P_pal - R_pa * Q_pa
```

### A7
```
C_pal * d(P_pal - P_pl)/dt = Q_pa - (Q_pal + Q_ps)
```

### A8
```
Q_pp,tot = Q_pal + Q_ps = Q_pal / (1 - sh)
```

### A9
```
Q_pal = (P_pal - P_pc) / R_pal
```

### A10
```
V_pal = C_pal * (P_pal - P_pl) + V_u,pal
```

### A11
```
C_pc * d(P_pc - P_A)/dt = Q_pal - Q_pc
```

### A12
```
Q_pc = (P_pc - P_pv) / R_pc
```

### A13
```
V_pc = C_pc * (P_pc - P_A) + V_u,pc
```

### A14
```
C_pv * d(P_pv - P_pl)/dt = Q_ps + Q_pc - Q_pv
```

### A15
```
Q_ps = sh / (1 - sh) * Q_pal
```

### A16
```
Q_pv = (P_pv - P_la) / R_pv
```

### A17
```
V_pv = C_pv * (P_pv - P_pl) + V_u,pv
```

## Lung-volume dependent pulmonary arteriolar resistance

Paper Eq. 3:

```
R_pal(V_A, sh)
  = R_pp,tot / [2 * (1 - sh)] * (V_A / FRC_nom)^2
```

where:
- `V_A` = alveolar volume;
- `sh` = shunt fraction;
- `R_pp,tot` = total pulmonary peripheral resistance at steady state and
  nominal FRC;
- `FRC_nom = 2.25 L`.

The intended effect is explicit: lung expansion increases pulmonary peripheral
resistance by compressing pulmonary capillaries/peripheral vessels, increasing
pulmonary impedance and RV afterload.

Paper Eq. 4 defines the equivalent total pulmonary peripheral resistance:

```
R_pp,tot =
  R_ps * (R_pc + R_pal@FRCnom)
  / [R_ps + R_pc + R_pal@FRCnom]
```

The candidate code does **not** invent `R_pc` or `R_ps` if a complete,
verified source value is unavailable.

## Source Table II parameters

Human generic-reference parameters preserved from Table II:

| Parameter | Value | Unit |
|---|---:|---|
| C_pa | 0.76 | mL/mmHg |
| V_u,pa | 0 | mL |
| R_pa | 0.023 | mmHg s/mL |
| L_pa | 1.8e-4 | mmHg s^2/mL |
| C_pal | 1.93 | mL/mmHg |
| V_u,pal | 43.30 | mL |
| C_pc | 3.87 | mL/mmHg |
| V_u,pc | 64.94 | mL |
| R_pp,tot | 0.0894 | mmHg s/mL |
| C_pv | 25.37 | mL/mmHg |
| V_u,pv | 105.6 | mL |
| R_pv | 0.0056 | mmHg s/mL |
| FRC_nom | 2.25 | L |

The paper describes a generic 70-kg healthy reference subject. These values are
not patient-specific ARDS anatomy.

## Validation scope

The enhanced model was evaluated against human mechanical-ventilation data,
including:
- positive pressure ventilation in healthy subjects;
- PEEP steps in sedated patients;
- intra-breath cardiovascular variation in sedated mechanically ventilated
  patients.

The paper reports normal-resting hemodynamics within expected ranges and
qualitative/transient agreement with the ventilation datasets.

The paper also explicitly states that its respiratory model does **not** model
PEEP-induced recruitment and gas-exchange improvement. Vent therefore remains
the candidate owner of recruitment/mechanics; the Karamolegkos circulation is
being evaluated for pulmonary vascular and heart-lung mechanical coupling.

## Regional V/Q and HPV: separate problem

Karamolegkos 2021 is not, by itself, a regional HPV/VQ distribution model.

A second source family under review is:

Marquis AD, Jezek F, Pinsky DJ, Beard DA.
**Hypoxic pulmonary vasoconstriction as a regulator of alveolar-capillary
oxygen flux: A computational model of ventilation-perfusion matching.**
PLoS Comput Biol. 2021;17:e1008861.
DOI: 10.1371/journal.pcbi.1008861.

Public implementation:
`beards-lab/VQmodel`
reviewed source tree:
`59416ed8f777a82df29c4b5707150cd58d9b4b32`.

Exact source-code HPV relations include:

```
S_i = exp(-P_alv,O2,i / P_HPV)
```

```
T_inf = conducted_weighted_signal * (T_max - T_min) + T_min
```

```
dT/dt = (T_inf - T) / tau
```

and vascular modulation:
```
R_v,A <- R_v,A * T
C_v,A <- C_v,A / T
```

However, Marquis is a **rat-lung** model and its fitted HPV parameters are not
authorized as human constants. The code contains additional explicitly
engineering choices. Therefore its equations are retained as mechanistic
reference only until a defensible human translation/validation strategy exists.

## Current hard integration boundary

Vent currently reports elastic compartment volume, not a source-verified
absolute Karamolegkos alveolar volume coordinate.

No implicit conversion such as

`V_A = FRC_nom + Vent.totalVolume`

is authorized yet.

That bridge must be derived and documented before Eq. 3 is allowed to drive
canonical PVR/PAP in the digital patient.

This is intentional fail-closed behavior, not a missing convenience feature.
