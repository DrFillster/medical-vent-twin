# v1.5 Gas-Autonomic Cardiovascular Candidate Promotion

Date: 2026-10-11
Status: **candidate-not-canonical**

## Decision

Promote the integrated Ursino/Magosso gas-autonomic cardiovascular pathway from diagnostic shadow status to a **candidate subsystem**.

The candidate is permitted to control the non-canonical Ursino cardiovascular candidate plant.

It is **not permitted** to control the canonical bedside patient state.

## Candidate composition

### Afferent inputs
- systemic arterial pressure -> Ursino 1998 baroreceptor afferent;
- PaO2 + PaCO2 -> Magosso & Ursino 2001 peripheral chemoreceptor;
- PaO2 -> source CNS hypoxia terms;
- PaCO2 -> source CNS CO2 terms;
- actual tidal volume input -> Ursino & Magosso pulmonary stretch pathway.

### Autonomic outputs
- f_sp: arterial/peripheral sympathetic;
- f_sv: venous sympathetic;
- f_sh: cardiac sympathetic;
- f_v: cardiac vagal.

### Candidate cardiovascular effectors
- f_sp -> splanchnic/extrasplanchnic peripheral resistance;
- f_sv -> splanchnic/extrasplanchnic venous unstressed volume;
- f_sh -> LV/RV Emax and sympathetic heart-period component;
- f_v -> vagal heart-period component.

All downstream gains, delays, time constants, offsets, and firing thresholds remain source-family values. No new fitted gain was introduced for this promotion.

## Authority boundary

Allowed:
- read candidate plant systemic arterial pressure;
- read candidate/test PaO2, PaCO2, and VT;
- compute source-family autonomic firing;
- compute source-family effector states;
- control the **candidate cardiovascular plant**.

Not allowed:
- write canonical bedside HR;
- write canonical MAP/CO/SV/SVR;
- override Vent mechanics;
- replace canonical gas exchange;
- modify HumMod to force agreement;
- calibrate gains to obtain a desired tachycardia.

## Source provenance

- Ursino M. 1998. DOI 10.1152/ajpheart.1998.275.5.H1733.
- Ursino M, Magosso E. 2000. DOI 10.1152/ajpheart.2000.279.1.H149.
- Magosso E, Ursino M. 2001. DOI 10.1152/ajpheart.2001.281.5.H2036.

## Implementation commits

- `0958253209dd137452f462ec6f1889b934b32003`: promoted integrated gas-autonomic effector controller.
- `dfca291a458ba10eb7a27f8f93975c4a1d4b6aa6`: added gas-autonomic closed-loop candidate plant.
- `6d20a918479c704e406a21fdc842fb2a2225d73a`: perturbation regression gate.

## Required validation before canonical consideration

1. Execute the perturbation gate:
   - normoxia/normocapnia;
   - isolated hypoxia;
   - isolated hypercapnia;
   - combined hypoxic-hypercapnia.
2. Add recovery-to-baseline testing.
3. Add step-size convergence testing for the explicit controller/plant coupling boundary.
4. Compare isolated hypoxia and hypercapnia trajectories with primary-source and independent human validation datasets.
5. Confirm no instability or nonphysical Emax/resistance/venous-volume/heart-period state.
6. Confirm the candidate behaves coherently when VT changes independently of blood gases.
7. Only then consider exposing the candidate as a physician-selectable noncanonical model.

## Execution status

A narrow candidate smoke workflow was executed on GitHub Actions.

Run:
- workflow: `v1.5 Candidate Smoke`
- run ID: `38191738869`
- head SHA: `905fdc76820de4c2ec75107f1d5622b8ae8afdea`
- conclusion: **success**

Passed gates:
1. gas-autonomic promotion parity;
2. gas-cardiovascular perturbation gate;
3. Ursino Fig. 9 sensitivity gate;
4. Ursino source-reproduction gate.

Interpretation:
- promotion from shadow to candidate did not change the underlying source-family physiology;
- normoxia, isolated hypoxia, isolated hypercapnia, and combined hypoxic-hypercapnia produced finite distinct candidate responses;
- the Fig. 9 effector sensitivity ordering remained source-consistent;
- the source-reproduction harness remained green.

This is a **candidate-layer validation pass**, not canonical validation. Independent human trajectory validation, recovery testing, and explicit coupling step-size convergence remain required before canonical consideration.


## Recovery and numerical convergence gate

A second narrow candidate smoke run was executed after adding recovery and coupling-convergence tests.

Run:
- workflow: `v1.5 Candidate Smoke`
- run ID: `38193016501`
- head SHA: `8c92866820b6364ef8a8f79d44bba7ca3f5f11a0`
- conclusion: **success**

New gate results:
- recovery after combined hypoxic-hypercapnic stress: **PASS**;
- explicit controller/plant step-size convergence: **PASS**.

Recovery criterion:
- after 120 s baseline and 120 s combined PaO2 50 / PaCO2 60 stress, restoration to PaO2 100 / PaCO2 40 for 180 s moved the tracked HR/MAP/Emax/resistance/venous-volume state closer to the prior baseline.

Convergence criterion:
- tested dt = 0.004, 0.002, and 0.001 s;
- the 0.002-s solution remained within 1% of the 0.001-s solution across the tracked integrated outputs;
- halving dt from 0.004 to 0.002 did not move the result farther from the 0.001-s solution.

These criteria establish numerical and recovery fitness for continued **candidate-layer** evaluation. They do not establish clinical validity or canonical authority.
