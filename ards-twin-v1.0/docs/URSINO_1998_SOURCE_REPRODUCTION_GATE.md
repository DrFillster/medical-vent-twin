# Ursino 1998 Closed-Loop Source-Reproduction Gate

Date: 2026-10-11
Branch: `v1.5`
Authority: **candidate-not-canonical**

## Purpose

This gate tests the closed-loop cardiovascular candidate against the primary source before it can control the digital patient.

Primary source:
Mauro Ursino. *Interaction between carotid baroregulation and the pulsating heart: a mathematical model.* Am J Physiol Heart Circ Physiol. 1998;275:H1733-H1747. DOI: 10.1152/ajpheart.1998.275.5.H1733.

## Source protocol

The primary paper's acute-hemorrhage experiment:
- removes 10% of total blood volume;
- performs the loss over 5 s;
- evaluates the model at 80 s after the perturbation;
- compares percent change in mean systemic arterial pressure (SAP), cardiac output (CO), total systemic resistance (R), and heart rate (HR).

The source states that the model reproduces the acute-hemorrhage response fairly well and that the modeled HR increase is smaller than the experimental intact-dog response.

## Harness correction

The initial candidate challenge was invalid for source reproduction because:
1. it removed 10% blood volume instantaneously rather than over 5 s;
2. it recorded instantaneous ventricular outflow rather than a multi-beat mean CO;
3. its fixed-step timing could fail because accumulated floating-point time was subtracted and then required to be an exact 2-ms multiple.

These are test-harness defects. The physiologic equations were not changed.

Corrective commits:
- `7ee22d4a8adfe85be46e34b5843e1278aad81e2c`
- `78f764c6e88b8f256967e89505944bbb77a937fa`
- `659fff05c9e8d471ae4dba111a95f0aa7d3f10e8`

## Current local reproduction run

Numerical step: 0.002 s
Settling interval before basal tracing: 60 s
Mean measurement method: source-style 20-s-or-longer tracing, aligned to an integer number of ventricular cycles, trapezoidal time integration
Blood loss: 530 mL over 5 s
Post-hemorrhage tracing: begins after the 80-s source evaluation point

### Baseline
- HR: 70.9129 /min
- mean SAP: 100.2076 mmHg
- mean LV outflow / CO: 89.9192 mL/s (5.3952 L/min)
- equivalent systemic resistance: 0.98747 mmHg*s/mL
- PPA: 18.6135 mmHg
- PRA: 4.9916 mmHg
- PLA: 8.0020 mmHg
- averaging trace: 20.306 s / 24 ventricular cycles

### 80-s post-hemorrhage state
- HR: 77.0996 /min
- mean SAP: 90.4573 mmHg
- mean LV outflow / CO: 75.8401 mL/s (4.5504 L/min)
- equivalent systemic resistance: 1.07334 mmHg*s/mL
- PPA: 14.3889 mmHg
- PRA: 3.6487 mmHg
- PLA: 5.4385 mmHg
- averaging trace: 20.234 s / 26 ventricular cycles

### Percent change from baseline
- SAP: **-9.7301%**
- CO: **-15.6575%**
- systemic resistance: **+8.6962%**
- HR: **+8.7244%**

Additional internal response:
- LV Emax increases from 2.9539 to 3.0808 mmHg/mL.
- RV Emax increases from 1.7456 to 1.8210 mmHg/mL.
- splanchnic venous unstressed volume decreases from 1121.6 to 1050.9 mL.
- extrasplanchnic venous unstressed volume decreases from 1380.4 to 1345.0 mL.
- baroreceptor firing decreases, sympathetic efferent firing increases, and vagal firing decreases.

The source states that values plotted in Figs. 3-9 were obtained from a 20-s stationary tracing, with an integer number of heart periods selected and trapezoidal averaging. The v3 harness now reproduces that measurement method.


## Primary-source parameter fidelity audit

The candidate constants were checked directly against Tables 1-3 of the 1998 primary article.

### Vascular plant — Table 1
Matched values include:
- systemic arterial: C=0.28 mL/mmHg, R=0.06 mmHg*s/mL, L=0.22e-3 mmHg*mL^-1*s^2;
- splanchnic peripheral: C=2.05, Vu=274.4 mL, R=3.307;
- extrasplanchnic peripheral: C=1.67, Vu=336.6 mL, R=1.407;
- splanchnic venous: C=61.11, Vu=1121 mL, R=0.038;
- extrasplanchnic venous: C=50.0, Vu=1375 mL, R=0.016;
- pulmonary arterial: C=0.76, R=0.023, L=0.18e-3;
- pulmonary peripheral: C=5.80, Vu=123 mL, R=0.0894;
- pulmonary venous: C=25.37, Vu=120 mL, R=0.0056;
- total blood volume=5300 mL.

### Heart — Table 2
Matched values include:
- atrial compliances 19.23 / 31.25 mL/mmHg;
- atrial unstressed volumes 25 / 25 mL;
- AV-valve resistances 2.5e-3 mmHg*s/mL;
- ventricular P0=1.5 / 1.5 mmHg;
- kE=0.014 / 0.011 mL^-1;
- ventricular unstressed volumes 16.77 / 40.8 mL;
- basal Emax=2.95 / 1.75 mmHg/mL;
- ventricular resistance coefficients 3.75e-4 / 1.4e-3 s/mL;
- basal heart period 0.833 s;
- ksys=0.075 s^2 and Tsys0=0.5 s.

### Regulatory system — Table 3
Matched values include:
- carotid afferent Pn=92 mmHg, fmin=2.52 spikes/s, fmax=47.78 spikes/s, ka=11.758 mmHg, tauz=6.37 s, taup=2.076 s;
- sympathetic f-infinity=2.10 spikes/s, f0=16.11 spikes/s, k=0.0675 s, lower threshold=2.66 spikes/s;
- vagal f0=3.2 spikes/s, f-infinity=6.3 spikes/s, k=7.06 spikes/s, central firing point=25 spikes/s;
- LV/RV Emax effector gains 0.475 / 0.282, tau=8 s, delay=2 s, offsets 2.392 / 1.412;
- splanchnic/extrasplanchnic resistance gains 0.695 / 0.53, tau=6 s, delay=2 s, offsets 2.49 / 0.78;
- venous unstressed-volume gains -265.4 / -132.5 mL per neural-rate unit, tau=20 s, delay=5 s, offsets 1435.4 / 1537 mL;
- sympathetic heart-period gain -0.13 s per neural-rate unit, tau=2 s, delay=2 s;
- basal heart-period term 0.58 s;
- vagal heart-period gain 0.09 s per neural-rate unit, tau=1.5 s, delay=0.2 s.

### Audit conclusion
No Table 1-3 parameter mismatch was found in the current candidate.

This narrows the remaining source-reproduction risk to:
1. equation transcription/implementation;
2. delayed-state numerical implementation;
3. exact interpretation of the Fig. 9 evaluation window;
4. extraction of the Fig. 9 model bar heights.

Do not change a verified source parameter to improve agreement with Fig. 9.

## Numerical convergence check

The corrected source-protocol challenge was repeated without changing physiology at three fixed RK4 step sizes:

| dt | SAP change | CO change | R change | HR change |
| --- | ---: | ---: | ---: | ---: |
| 0.004 s | -9.7273% | -15.6430% | +8.6956% | +8.7238% |
| 0.002 s | -9.7301% | -15.6575% | +8.6962% | +8.7244% |
| 0.001 s | -9.7295% | -15.6534% | +8.6965% | +8.7248% |

Interpretation:
- the candidate hemorrhage response is effectively step-size stable over this range;
- the remaining quantitative uncertainty is therefore dominated by source reproduction / protocol interpretation rather than an obvious fixed-step numerical artifact;
- this does not prove equation fidelity or physiologic validity.

## Interpretation

The candidate currently has the correct qualitative closed-loop pattern for the source challenge:
- SAP falls;
- CO falls;
- systemic resistance rises;
- HR rises;
- venous unstressed volume falls;
- cardiac elastance rises.

This is **not a quantitative source-reproduction pass**.

The exact Fig. 9 model bar heights have not yet been transcribed from the primary figure with sufficient accuracy. Do not substitute the intact-dog experimental values for the source-model values. Do not tune the model to either set.

## Acceptance gate

Before this candidate is integrated into the canonical patient state:

1. obtain a reproducible numeric transcription/digitization of the **model** bars in primary-source Fig. 9;
2. record the extraction method and uncertainty;
3. compare SAP, CO, R, and HR percent changes with the candidate;
4. investigate any mismatch by equation/parameter/protocol audit first;
5. do not add compensating gains;
6. keep authority `candidate-not-canonical` until the source-reproduction gate passes.

## Next integration step after source reproduction

If the source challenge passes, extend this same coherent cardiovascular plant with the already sourced O2/CO2 autonomic inputs. Do not return to an isolated PaO2/PaCO2-to-HR correction.
