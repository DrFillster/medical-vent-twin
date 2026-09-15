# ARDS Virtual Patient / Digital Twin v0.3 Architecture Handoff

## Purpose
This package is an implementation handoff for converting the current quasi-static three-compartment educational lung model into a time-domain ARDS virtual-patient simulator with a separate ventilator engine.

The immediate goal is **not** a clinically validated patient-specific digital twin. The v0.3 target is a dynamic virtual patient architecture that can later support patient calibration.

## Core design decision
Preserve the existing v0.2.0-rc1 model as a reference/verification engine. Build a new dynamic engine beside it. Do not mutate the reference equations merely to make the new engine fit.

```
reference model (existing, quasi-static)
             |
             | regression targets / limiting-case checks
             v
new dynamic patient engine <----> ventilator controller
             |
             v
        monitor / UI
```

## v0.3 definition of done
A deterministic time-domain engine that:
1. Represents three lung compartments with independent dynamic volume/flow state.
2. Separates patient physiology from ventilator control.
3. Implements passive VC-A/C first.
4. Produces pressure, flow and volume waveforms.
5. Exposes Ppeak, Pplat, PEEP, Vt and minute ventilation from simulated state.
6. Holds recruitment fixed initially, then supports dynamic recruitment in a later milestone.
7. Can be tested against the existing quasi-static model in appropriate limiting conditions.

## Package contents
- `spec/ARCHITECTURE.md` — target architecture and boundaries.
- `spec/HUMMOD_TEARDOWN.md` — architectural lessons from HumMod, with licensing boundary.
- `spec/IMPLEMENTATION_PLAN.md` — staged implementation sequence.
- `spec/STATE_SCHEMA.md` — state ownership and data structures.
- `spec/VENTILATOR_CONTRACT.md` — ventilator/patient interface.
- `spec/NUMERICS.md` — solver and timestep requirements.
- `spec/TEST_PLAN.md` — acceptance and regression tests.
- `spec/LLM_IMPLEMENTATION_PROMPT.md` — direct prompt for another coding LLM.
- `scaffold/` — non-physiologic code scaffolding only.
- `reference/current_manuscript_v0.2.0-rc1.pdf` — current report supplied by project owner.

## Safety/scope
Educational simulation only. No clinical decision support. No patient-specific claims. No ventilator recommendations should be inferred from the model until separately validated.
