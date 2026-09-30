# HumMod Production Runtime Strategy

## Decision

Do **not** make production v2.0 dependent on automating `HumMod.exe`.

`HumMod.exe` remains valuable as a reference implementation and regression oracle, but the preferred production architecture is a modern headless runtime that executes the pinned HumMod model semantics directly from the official `.DES` source tree.

## Why

The current HumMod distribution separates:
- the model description (`.DES` files);
- composition/include directives;
- model state / solutions;
- the Windows executable that parses and executes the model.

The physiological source therefore exists independently of the legacy GUI executable. Our long-term objective should be to preserve the model semantics, not the Windows interface.

Canonical HumMod source:
- official repository: `HumMod/hummod-standalone`
- official revision: **unresolved in the current GitHub API surface**
- reproducibility mirror: `riliescu/hummod-standalone@8dab57e05631f779bf5020fe0dd51874d8ae98c1`

Scientific provenance must name the official HumMod repository. The mirror SHA is retained only as a byte-addressable snapshot until an official upstream SHA can be independently resolved.

## Production options

### Option A — headless DES interpreter/runtime — preferred first target

Pipeline:

```
official HumMod DES
        |
        v
DES parser -> intermediate representation -> dependency graph -> solver/runtime
                                                        |
                                                        v
                                                 versioned API
```

Advantages:
- preserves official model structure;
- eliminates Windows/Wine/GUI automation from production;
- source-level provenance can map every runtime symbol to its exact DES path;
- deterministic state save/restore is feasible;
- backend can run on Linux/macOS;
- enables direct unit and regression testing.

Primary risk:
- accurately reproducing DES execution semantics, ordering, curves, switches, delays, integration, and initialization.

### Option B — DES to generated JavaScript/TypeScript

Use the same parser/intermediate representation, but compile structures/blocks/equations into generated code.

Advantages:
- fast execution;
- potentially browser-compatible;
- generated code can preserve source metadata;
- simpler deployment after compilation.

Risk:
- code generation still requires us to define the DES language and solver semantics correctly.

Recommended relationship:
Build Option A's parser/IR first. The same IR can later support both interpretation and code generation.

### Option C — Modelica/FMI bridge

Translate or reuse HumMod-related Modelica work and expose physiology through FMI/FMUs.

Advantages:
- mature solver ecosystem;
- standardized co-simulation;
- good headless deployment options.

Limitations:
- existing Modelica implementations may represent older HumMod versions;
- equivalence to the pinned official source must be demonstrated rather than assumed.

Use as a reference/alternative implementation, not automatically as the canonical HumMod runtime.

### Option D — HumMod.exe wrapper

Keep Wine/Windows automation around the executable.

Use only for:
- regression baselines;
- native .SOLN generation;
- spot checks;
- semantic questions where our runtime disagrees with the reference executable.

This is not the preferred production interface.

### Option E — reduced hand-ported core

Continue to maintain the existing reduced browser core as:
- v1.x physiology;
- fallback/research surrogate;
- coupling-development harness.

Do not expand it indefinitely as a manual reimplementation of all HumMod physiology.

## Revised v2.0 definition

**v2.0 = Vent mechanics coupled to a full-semantics HumMod runtime through a modern deterministic interface.**

The runtime may be:
1. our headless DES interpreter; or
2. generated code from the same verified DES intermediate representation.

It does **not** need to be `HumMod.exe`.

## Role of HumMod.exe

Treat the executable as a reference oracle:

```
                   +-----------------> HumMod.exe reference trajectories
official DES ------|
                   +-----------------> headless runtime under test
                                            |
                                            v
                                    numerical comparison
```

A growing regression corpus should compare:
- initialization;
- steady state;
- interventions;
- short dynamic perturbations;
- long trajectories;
- state save/reload;
- selected intermediate variables.

## Development rule

Before manually porting another large HumMod subsystem into bespoke JavaScript, ask whether it should instead be supported by the generic DES runtime.

Manual ports should be limited to:
- temporary v1.x reduced models;
- isolated verified primitives;
- coupling adapters;
- tests/reference implementations.

## Go/no-go criterion for headless runtime

Proceed with the headless runtime if a representative model slice demonstrates that:
- the DES syntax can be parsed without source modification;
- block/call/copy/testcase semantics can be represented in an IR;
- curve semantics can be reproduced;
- dependency resolution is tractable;
- a small subsystem numerically matches native HumMod;
- solver/state semantics can be isolated and tested.

If those fail, reassess code generation or FMI/Modelica rather than falling back automatically to GUI automation.
