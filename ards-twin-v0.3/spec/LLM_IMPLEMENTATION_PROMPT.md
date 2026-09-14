# Prompt for Coding LLM

You are implementing v0.3 of a browser-based ARDS virtual-patient simulator.

Read every file in this package before changing code. The current `reference/current_manuscript_v0.2.0-rc1.pdf` defines the existing model's scope and must remain historically reproducible.

## Objective
Create a new time-domain dynamic respiratory engine while preserving the existing quasi-static engine as a reference implementation.

## Non-negotiable architecture
1. `reference != dynamic engine != ventilator != UI`.
2. Patient physiology must not contain VC/PC mode logic.
3. Ventilator controllers produce boundary conditions; the lung solver responds to them.
4. Use persistent time-domain state.
5. Keep v0.3 passive; do not add spontaneous effort yet.
6. Keep recruitment fixed until dynamic mechanics + VC are tested.
7. Do not silently coerce invalid states.
8. Do not claim clinical validation.
9. Do not copy HumMod code or equations. HumMod is an architectural reference only.

## First implementation slice
Implement only Milestones 0-3:
- preserve reference model
- simulation clock/state
- dynamic passive three-compartment mechanics
- VC-A/C with square inspiratory flow and inspiratory pause
- headless trace generation
- tests

## Required deliverables
- source code
- unit tests
- deterministic benchmark JSON
- short architecture note describing actual implementation
- mapping of new code modules to this specification
- list of assumptions introduced
- list of deviations from the spec, if any

## Acceptance criteria
Use `spec/TEST_PLAN.md`. Do not move to PC-A/C until VC-A/C and the dynamic mechanics tests pass.

## Important modeling discipline
If a physiological equation is not defined by the current model or this handoff, do not invent a clinically authoritative equation. Implement an explicit placeholder/strategy interface and document what evidence is needed.

## Suggested module layout
```
src/
  reference/
  dynamic/
    clock
    state
    mechanics
    compartments
    recruitment
    gas_exchange
  ventilator/
    controller
    vc_ac
    pc_ac
  monitor/
  presets/
test/
  reference/
  mechanics/
  ventilator/
  regression/
```

Begin with a repository audit. Preserve working tests before refactoring.
