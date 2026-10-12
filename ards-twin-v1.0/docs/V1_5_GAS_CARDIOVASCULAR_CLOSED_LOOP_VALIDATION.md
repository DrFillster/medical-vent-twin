# v1.5 Source-Family Gas/Cardiovascular Closed-Loop Validation

Date: 2026-10-11
Authority: **candidate-not-canonical**
Control authority: **false**

## Purpose

Evaluate the integrated Ursino/Magosso source-family cardiovascular candidate under fixed-tidal-volume gas perturbations before any canonical patient-state cutover.

## Model composition

- Ursino 1998 pulsatile cardiovascular plant.
- Ursino & Magosso 2000 hypoxia, baroreflex, lung-stretch, and CNS-hypoxia autonomic pathways.
- Magosso & Ursino 2001 O2-CO2 interaction and CO2 cardiovascular pathways.
- Channelized sympathetic/vagal effectors for:
  - peripheral resistance;
  - venous unstressed volume;
  - LV/RV Emax;
  - heart period.
- Explicit dVuev/dt coupling into the 1998 extrasplanchnic venous pressure equation.

The numerical boundary is an explicit fixed-step operator split. It is not hidden and is not canonical.

## Prerequisite source gates

Before the gas challenge, the cardiovascular plant passed the qualitative Fig. 9 hemorrhage sensitivity requirements:
- all disabled-control cases start from the same settled basal state;
- delayed sympathetic/vagal histories are preserved across the branch point;
- venous unstressed-volume control is the dominant protector of SAP and CO;
- Emax has the smallest effect magnitude.

The exact numeric Fig. 9 bar-height reproduction remains pending reproducible figure digitization.

## Measurement method

Pulsatile hemodynamic quantities are not sampled at an arbitrary cardiac phase.

Each reported stage uses:
- dt = 0.002 s;
- >=20 s tracing;
- start aligned to a ventricular-cycle boundary;
- end on an integer ventricular cycle;
- trapezoidal time averaging.

This removes the phase-dependent artifact that previously produced instantaneous LV outflow values of either 0 or several hundred mL/s.

## Corrected cycle-averaged results

| Stage | PaO2 | PaCO2 | HR /min | mean SAP mmHg | CO L/min | peripheral R mmHg*s/mL |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Baseline | 100 | 40 | 70.27 | 99.37 | 5.37 | 0.983 |
| Isocapnic hypoxia, fixed VT | 50 | 40 | 61.79 | 120.81 | 5.29 | 1.235 |
| Recovery | 100 | 40 | 70.30 | 99.38 | 5.37 | 0.983 |
| Mild hypercapnia, fixed VT | 100 | 45 | 67.70 | 105.62 | 5.09 | 1.117 |
| Recovery | 100 | 40 | 70.27 | 99.37 | 5.37 | 0.984 |
| Hypoxic hypercapnia, fixed VT | 50 | 60 | 56.83 | 190.35 | 5.62 | 1.891 |
| Final recovery | 100 | 40 | 70.27 | 99.37 | 5.37 | 0.983 |

## Interpretation

### Controlled isocapnic hypoxia

The candidate produces:
- bradycardia;
- higher systemic arterial pressure;
- increased peripheral resistance;
- nearly preserved cardiac output;
- increased cardiac sympathetic drive and contractility;
- marked venoconstriction / reduced venous unstressed volume.

This is protocol-consistent with the selected source family. Ursino & Magosso describe an early chemoreflex phase with moderate SAP rise, HR fall, and approximately unchanged CO. Their validation paper also reports that controlled-ventilation hypoxia produces a significant HR decrease.

Do not compare this fixed-VT challenge directly with spontaneous-breathing healthy-human hypoxia studies and then add a tachycardia gain.

### Why spontaneous hypoxia must be a separate protocol

The same source family describes later tachycardia and CO augmentation after pulmonary ventilation rises, through lung-stretch and CNS-hypoxia mechanisms.

The current fixed-VT challenge intentionally prevents that respiratory response.

Therefore:
- controlled ventilation and spontaneous breathing are distinct model protocols;
- the next architecture must provide a source-complete respiratory neural-drive -> patient-effort -> actual VT coupling;
- only then can spontaneous-hypoxia validation be performed.

### Hypercapnia

The current mild fixed-VT hypercapnia challenge produces modest bradycardia, higher SAP/resistance, and lower CO.

Do not promote this as a universal hypercapnia response. The 2001 source explicitly models normoxic hypercapnia, artificial ventilation, and combined gas states as different conditions, with different contributions from ventilation, lung stretch, CNS CO2 response, and local vascular effects.

### Combined hypoxic hypercapnia

The current fixed-VT severe combined challenge produces very strong sympathetic/vascular activation, high SAP, major venoconstriction, higher Emax, and bradycardia.

This state remains a **stress test**, not a validated ICU trajectory. It requires source-protocol comparison and numerical convergence before any authority claim.

## Recovery

All three return-to-100/40 stages recover closely to the original basal mean state:
- HR returns to about 70.27 /min;
- SAP returns to about 99.37 mmHg;
- CO returns to about 5.37 L/min;
- peripheral resistance returns to about 0.983 mmHg*s/mL.

This argues against obvious persistent numerical drift in the staged challenge.

## Remaining gates

1. Fixed-step convergence for the integrated gas/autonomic/plant coupling.
2. Exact protocol-specific comparison with the 2000 controlled-ventilation hypoxia source.
3. Protocol-specific comparison with the 2001 artificial-ventilation hypercapnia simulations.
4. Respiratory-center / patient-effort integration.
5. Spontaneous-breathing hypoxia validation.
6. Independent human validation matched to the correct protocol.
7. No canonical activation until all ownership and validation gates pass.

## Decision

**KEEP AS SHADOW CANDIDATE. DO NOT ACTIVATE.**

The candidate is coherent enough to continue development, but the current fixed-VT gas response is not a general bedside ARDS cardiovascular model and must not be exposed as canonical physiology.
