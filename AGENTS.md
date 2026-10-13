# AGENTS.md — Vent Project Continuation Contract

These instructions apply to any AI/agent modifying this repository.

## Mandatory startup sequence

Before modifying code:

1. Query the live `v1.6` branch HEAD.
2. Read `START_HERE.md`.
3. Read `candidate-state.json`.
4. Read the **CURRENT RECOVERY POINT** block at the top of `ards-twin-v1.0/HANDOFF.md`.
5. Read the relevant equation/source ledger.
6. Inspect the implementation and focused tests for the module being changed.

Do not substitute conversational memory for this sequence.

## Before coding, state the work in one sentence

The agent must be able to state:

> Current objective = ____. Current owner/module = ____. Immediate blocker = ____. Deferred work = ____. Focused validation = ____.

If the answer conflicts with `candidate-state.json`, stop. Repository state wins over remembered context.

## Clinical scope gate

Current milestone: **finish the physician-testable integrated ARDS candidate first**.

Until that milestone is explicitly marked complete in `candidate-state.json` and `HANDOFF.md`:

- do not activate sepsis/vasoplegia;
- do not activate pressors/inotropes;
- do not broaden endocrine/metabolic reconstruction;
- do not spend effort on UI polish unrelated to physician validation;
- do not reopen old reduced HumMod models as the primary architecture.

A newly discovered dependency is **not automatically the next task**. First ask whether it is required to reach the current milestone.

## Physiologic authority rules

- Vent owns ventilator settings, airway mechanics, recruitment, pressures, holds and waveforms.
- The Ursino/Magosso source-family candidate owns the candidate cardiovascular/autonomic plant.
- HumMod is a source/donor/comparator, not the project truth standard.
- Myocardial pHi must be a derived intracellular state, not arterial pH.
- Candidate/shadow modules do not become canonical by convenience.
- One canonical owner per physiologic variable.

## No invented glue

Do not introduce a physiologic gain, threshold, transform, baseline, drug effect or coordinate conversion solely because two valid modules need to connect.

When a bridge is unresolved:

1. identify the exact upstream and downstream coordinates;
2. locate a source-backed transform;
3. if none is verified, fail closed and document the boundary;
4. continue other milestone work that does not require that bridge.

Explicitly forbidden unless superseded by a documented source decision:

- `FRC + Vent.totalVolume` -> absolute alveolar volume;
- `perfusionFraction * recruitment` -> final regional perfusion/VQ;
- arterial pH -> myocardial pHi;
- timer-based terminal rhythm transitions;
- fixed arterial-pH death threshold;
- direct MAP-targeting pressor logic;
- unsourced corrective gains.

## Physician-variability rule

Do not alter equations merely because a source reproduction or integrated trajectory is modestly different from an expected bedside number.

If equations, parameters, units and measurement method are correct and the remaining discrepancy is biologically plausible, preserve the equations and surface the result for physician judgment. Tight regression bands are not automatically physiology requirements.

## Test and commit discipline

Use focused tests first. GitHub Actions should be used sparingly.

For each meaningful positive or negative test:

1. preserve the result;
2. classify it as physiology, implementation, infrastructure, test-fixture, or source ambiguity;
3. append the checkpoint to `ards-twin-v1.0/HANDOFF.md`;
4. do not change physiology to repair an infrastructure/test-fixture failure.

Do not claim a gate passed unless it actually executed and returned success.

## Handoff discipline

`ards-twin-v1.0/HANDOFF.md` is the chronological journal.

Its top **CURRENT RECOVERY POINT** block is the operational summary. Keep historical entries below it intact.

After a meaningful change, update the current block with:

- live branch/last verified HEAD or recovery SHA;
- current objective;
- completed work;
- current blocker;
- last green gate;
- last negative result;
- exact next step;
- explicit deferred work.

## Equation/reference discipline

Before changing physiology, consult the relevant ledger under `ards-twin-v1.0/docs/`, especially:

- `physiology-registry.json`
- `PULMONARY_VASCULAR_CANDIDATE_EQUATION_LEDGER.md`
- `OXYGEN_DELIVERY_EVIDENCE_STACK.md`
- `VENT_TO_PULMONARY_VASCULAR_COORDINATE_AUDIT.md`

For a new equation or model relation, record:

1. equation;
2. source and revision;
3. units;
4. intended physiologic effect;
5. authority status;
6. integration owner;
7. validation status.

## Stop conditions

Stop and document rather than improvise if:

- the requested bridge lacks a verified source relation;
- two modules claim the same physiologic variable;
- a unit or coordinate is ambiguous;
- a source parameter appears inconsistent with its primary paper;
- a test failure would require changing physiology before its cause is classified;
- proposed work is outside the current milestone.

The project objective is a coherent digital patient, not maximal subsystem count.
