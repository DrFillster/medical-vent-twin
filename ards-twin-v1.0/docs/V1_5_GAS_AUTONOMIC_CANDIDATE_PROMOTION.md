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

The perturbation test is checked in but has not been claimed as executed.

Current tool constraints:
- local container lacks outbound DNS to clone GitHub;
- the available GitHub integration exposes workflow inspection/re-run operations but not workflow dispatch.

Do not mark this gate green until an actual test run is recorded.
