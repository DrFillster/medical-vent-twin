# Ursino-Magosso 2000 Expanded Systemic Vascular Plant Ledger

Date: 2026-10-11
Authority: **candidate-not-canonical**
Primary source:
Ursino M, Magosso E. Acute cardiovascular response to isocapnic hypoxia. I. A mathematical model. Am J Physiol Heart Circ Physiol. 2000;279:H149-H165.
DOI: 10.1152/ajpheart.2000.279.1.H149.

## Architecture

The 2000 source expands the 1998 systemic circulation into five parallel systemic beds downstream of the common systemic peripheral pressure Psp:

- splanchnic: sp -> sv
- remaining extrasplanchnic: ep -> ev
- skeletal muscle: mp -> mv
- cerebral: bp -> bv
- coronary: hp -> hv

Brain and coronary resistance are locally regulated and are not reflex-controlled.
Skeletal-muscle resistance has both sympathetic and local metabolic control.
Splanchnic and remaining extrasplanchnic beds retain reflex vascular control.

This expanded plant is required before the 2000/2001 local O2/CO2 equations can be integrated. Do not apply local gas regulation to the aggregate 1998 Rep.

## Table 1 — primary vascular parameters

| Bed | Compliance mL/mmHg | Unstressed volume mL | Resistance mmHg*s/mL |
| --- | ---: | ---: | ---: |
| systemic artery sa | 0.28 | 0 | 0.06 |
| splanchnic peripheral sp | 2.05 | 274.4 | 3.307 |
| extrasplanchnic peripheral ep | 0.668 | 134.64 | 3.52 |
| skeletal-muscle peripheral mp | 0.525 | 105.8 | 4.48 |
| cerebral peripheral bp | 0.358 | 72.13 | 6.57 |
| coronary peripheral hp | 0.119 | 24 | 19.71 |
| splanchnic venous sv | 61.11 | 1121 | 0.038 |
| extrasplanchnic venous ev | 20 | 550 | 0.04 |
| skeletal-muscle venous mv | 15.71 | 432.14 | 0.05 |
| cerebral venous bv | 10.71 | 294.64 | 0.075 |
| coronary venous hv | 3.57 | 98.21 | 0.224 |
| pulmonary artery pa | 0.76 | 0 | 0.023 |
| pulmonary peripheral pp | 5.80 | 123 | 0.0894 |
| pulmonary venous pv | 25.37 | 120 | 0.0056 |

Arterial inertances:
- Lsa = 0.22e-3 mmHg*s^2/mL
- Lpa = 0.18e-3 mmHg*s^2/mL

## Source vascular equations

Pulmonary Eqs. 1-4 and systemic artery Eqs. 5-6 retain the 1998 structure.

### Eq. 7 — common systemic peripheral pressure

```
dPsp/dt =
  1/(Csp + Cep + Cmp + Cbp + Chp) *
  [
    Fsa
    - (Psp-Psv)/Rsp
    - (Psp-Pev)/Rep
    - (Psp-Pmv)/Rmp
    - (Psp-Pbv)/Rbp
    - (Psp-Phv)/Rhp
  ]
```

### Eq. 8 — splanchnic venous pressure

```
dPsv/dt =
  1/Csv *
  [
    (Psp-Psv)/Rsp
    - (Psv-Pra)/Rsv
    - dVu,sv/dt
  ]
```

### Eq. 9 — skeletal-muscle venous pressure

```
dPmv/dt =
  1/Cmv *
  [
    (Psp-Pmv)/Rmp
    - (Pmv-Pra)/Rmv
    - dVu,mv/dt
  ]
```

### Eq. 10 — cerebral venous pressure

```
dPbv/dt =
  1/Cbv *
  [
    (Psp-Pbv)/Rbp
    - (Pbv-Pra)/Rbv
  ]
```

### Eq. 11 — coronary venous pressure

```
dPhv/dt =
  1/Chv *
  [
    (Psp-Phv)/Rhp
    - (Phv-Pra)/Rhv
  ]
```

The source states that active dVu/dt terms are present only in reflex-regulated venous compartments. In this architecture, skeletal-muscle and splanchnic venous capacitance are active; brain and coronary venous compartments are passive.

### Eqs. 12-13 — remaining extrasplanchnic venous pressure and total-volume closure

The source computes Pev algebraically from known total blood volume, while Psv, Pmv, Pbv, and Phv are dynamic states. Total unstressed volume is the sum of all compartment unstressed volumes.

Before implementing this closure, the exact printed Eq. 12 numerator will be retained verbatim in code documentation and tested for conservation of total blood volume.

## Basal compatibility requirement

The source states that the parallel arrangement of e + m + b + h was parameterized so that in normoxia it reproduces the overall extrasplanchnic behavior of the prior 1998 plant.

Therefore the first candidate gate is:
- no gas/local regulation;
- source basal effectors;
- expanded 2000 plant must settle to a finite periodic orbit;
- total blood-volume closure must be conserved;
- aggregate extrasplanchnic conductance/flow must remain compatible with the intended 1998 basal reference without fitting.

## Local-regulation integration gate

After passive-plant source reproduction:
- cerebral Eqs. 8-11 from Magosso/Ursino 2001 may control Gbp;
- coronary/skeletal-muscle Eqs. 12-15 may control Rhp/Rmp;
- source-valid CvbO2, CvhO2, CvmO2 are required;
- no guessed extraction fraction is permitted.
