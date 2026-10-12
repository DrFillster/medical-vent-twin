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

## Current local reproduction run

Numerical step: 0.002 s
Settling interval: 60 s
Baseline measurement: 5-s multi-beat mean
Blood loss: 530 mL over 5 s
Post-hemorrhage measurement: starts 80 s after hemorrhage onset, 5-s multi-beat mean

### Baseline
- HR: 70.9001 /min
- mean SAP: 99.8900 mmHg
- mean LV outflow / CO: 86.8939 mL/s (5.2136 L/min)
- equivalent systemic resistance: 0.98749 mmHg*s/mL
- PPA: 18.4876 mmHg
- PRA: 4.9842 mmHg
- PLA: 7.9943 mmHg

### 80-s post-hemorrhage state
- HR: 77.1049 /min
- mean SAP: 90.7856 mmHg
- mean LV outflow / CO: 82.6058 mL/s (4.9564 L/min)
- equivalent systemic resistance: 1.07319 mmHg*s/mL
- PPA: 14.5337 mmHg
- PRA: 3.6620 mmHg
- PLA: 5.4508 mmHg

### Percent change from baseline
- SAP: **-9.1144%**
- CO: **-4.9348%**
- systemic resistance: **+8.6788%**
- HR: **+8.7515%**

Additional internal response:
- LV Emax increases from 2.9539 to 3.0807 mmHg/mL.
- RV Emax increases from 1.7456 to 1.8209 mmHg/mL.
- splanchnic venous unstressed volume decreases from 1121.7 to 1051.0 mL.
- extrasplanchnic venous unstressed volume decreases from 1380.4 to 1345.1 mL.
- baroreceptor firing decreases, sympathetic efferent firing increases, and vagal firing decreases.

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
