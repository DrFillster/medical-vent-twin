# v2.4 HR / MAP baro-chemoreflex replacement audit

Date: 2026-10-25
Status: ACTIVE SOURCE-PORT WORK; empirical HR floor is NOT accepted physiology

## Physician finding

During severe hypoxemia / hypercapnia with elevated MAP, the current Ursino/Magosso path can produce marked bradycardia despite maximal cardiac sympathetic firing.

Fixed diagnostic:
- baseline: HR 73.3/min, fAb 16.1, fAc 4.0, fSh 7.0, fV 5.1 spikes/s
- severe gas + MAP 104: source HR 48.9/min, fAb 35.8, fAc 21.2, fSh 60 (maximum), fV 13.1
- same gas + MAP 70: source HR 73.9/min

Interpretation: the defect is excessive high-pressure baroreflex/vagal braking in this application, not absent sympathetic activation.

## Rejected bridge

The temporary PaCO2 -> minimum-HR interpolation in v2_source_autonomic_controller.js is not accepted as final physiology. It is an empirical bridge and must be removed before the next accepted physician preview once a complete published controller replaces it.

No HR=130 target or other desired-output gain is authorized.

## Albanese 2016 test

Primary source:
Albanese A, Cheng L, Ursino M, Chbat NW.
Am J Physiol Heart Circ Physiol. 2016;310:H899-H921.
doi:10.1152/ajpheart.00230.2014

A Table-7 autonomic candidate was transcribed and tested. It did NOT solve the fixed high-MAP severe-gas bradycardia:
- baseline HR 62.8/min
- severe high-MAP HR 48.5/min
- severe low-MAP HR 73.0/min

Therefore Albanese Table-7 calibration alone is not sufficient and must not be promoted simply because it is newer.

## Lin, Ngwompo & Tilley 2012: preferred replacement candidate

Primary source:
Lin J, Ngwompo RF, Tilley DG.
Development of a cardiopulmonary mathematical model incorporating a baro-chemoreceptor reflex control system.
Proc Inst Mech Eng H. 2012;226(10):787-803.
doi:10.1177/0954411912451823. PMID 23157080.

Why it is relevant:
- human cardiopulmonary model
- explicit interaction between baroreflex and peripheral/central chemoreflexes
- peripheral chemoreceptor resets the baroreflex operating point
- central chemoreceptor increases sympathetic gain during hypercapnia
- explicit nonlinear sympathetic + parasympathetic HR effector
- published validation reports predicted HR and MAP changes within 3% of measured changes during hypoxia and hypercapnia
- hypercapnic TPR agreement was weaker (predicted ~7% vs measured 23%), so vascular validation remains limited

### Primary-source equations already transcribed and tested

Eq. 30: peripheral gas state resets baroreflex operating pressure.

Using source coefficients from Table A3:
- k1 = -13.8
- k2 = 0.182
- k3 = 828
- PaCO2 floor = 40 mmHg
- PaO2 ceiling = 104 mmHg

Current exact shadow:
- reference gas PaO2 90 / PaCO2 40 -> Eq30 term 2.68 mmHg
- severe PaO2 35 / PaCO2 110 -> Eq30 term 29.877 mmHg
- source change = +27.197 mmHg

Eq. 31: central chemoreceptor changes sympathetic gain.

Table A3:
- k4 = 1
- k5 = -18.118
- PaCO2 floor = 40 mmHg

Current exact shadow:
- PaCO2 40 -> 21.882%
- PaCO2 110 -> 91.882%
- change = +70 percentage points

These pass CI in:
src/lin_2012_baro_chemoreflex_interaction_candidate.js
test/v24_lin_2012_baro_chemoreflex_interaction.test.js

They have NO control authority yet.

### Published baroreflex / HR structure to port next

Eq. 12:
P_aff / MAP = G_aff / (tau_aff s + 1)

Table A2:
- tau_aff = 0.001 s
- G_aff = 1

Eq. 13:
P_error = (P_demand - P_aff) / (tau_c s + 1)

P_demand is the baroreflex operating point and is reset by the peripheral chemoreceptor relation.

Eqs. 14-17:
sigmoid sympathetic and parasympathetic efferent outflow.

Table A2:
- SNAmax = 4 Hz
- SNAmin = 1.12 Hz
- S_s = -0.0138
- PNAmax = 6 Hz
- PNAmin = 0.6 Hz
- S_p = 0.0205

Eq. 18:
HR = HR0 + DeltaHR

Eq. 19:
DeltaHR = DeltaHR_s + DeltaHR_v + c * DeltaHR_s * DeltaHR_v

Eqs. 20-28:
published delayed, nonlinear, variable-time-constant sympathetic and parasympathetic HR effectors.

Table A2:
Sympathetic:
- G_s0^k = 90 beats/min/Hz
- G_s0^tau = 10 beats/min/Hz
- k_s0^k = 0.28
- k_s0^tau = 0.2
- T_s = 3 s

Parasympathetic:
- G_v0 = 60 beats/min/Hz
- k_v0 = 0.4
- tau_v = 0.1 s when firing increases / 0.8 s when firing decreases
- T_v = 0.5 s

Interaction:
- c = 0.017
- HR0 = 109/min

Figure 3 is essential for the sign convention: the vagal/PNA branch is inhibitory to HR. Do not infer the sign from OCR text alone.

## Remaining blockers before control cutover

1. Line-by-line verify the sign convention of the parasympathetic Eq. 25 / Figure 3 path.
2. Resolve the exact ratios in Eqs. 22, 24 and 27 from the primary typeset equation rather than OCR ordering.
3. Resolve tau_c in Eq. 13. It appears in the equation but is not plainly listed in Table A2 extraction.
4. Determine exactly whether Eq. 31 DeltaG_SNA enters Eq. 14 as a percentage divided by 100 or another source convention.
5. Port the entire Lin baro-chemoreflex + HR effector as one controller. Do NOT map Ursino spike/s into the Lin HR effector.
6. Run a MAP sweep with normal and severe gas states.
7. Only if the exact Lin model behaves credibly and reproduces its published validation direction should it receive live control authority.
8. Remove the temporary empirical HR floor before the next accepted physician preview.

## Acceptance test

Required fixed states:
- baseline: MAP 82, PaO2 90, PaCO2 40
- severe/high MAP: MAP 104, PaO2 35, PaCO2 110
- severe/lower MAP: MAP 70, same gases
- MAP sweep 60-110 mmHg under normal and severe gas states

Report:
- P_demand
- P_aff
- P_error
- SNA
- PNA
- sympathetic HR contribution
- parasympathetic HR contribution
- interaction term
- final HR

No tuning to obtain a desired HR is permitted.
