# HumMod DES Headless Runtime Feasibility Spike

## Scope

This spike evaluates whether the pinned official HumMod `.DES` tree can serve as the canonical source for a modern headless runtime.

Pinned source:
`riliescu/hummod-standalone@8dab57e05631f779bf5020fe0dd51874d8ae98c1`

## Initial source observations

### Composition

`HumMod.DES` uses preprocessor-style directives:
- `<?create ... ?>`
- `<?include Model.DES ?>`

`Model.DES` composes:
- `Context/Context.DES`
- `Structure/Structure.DES`
- Control/Display assets
- model math entrypoints: Context, Parms, Dervs, Wrapup.

A headless physiology runtime can therefore separate model execution from Control/Display concerns.

### Representative DES constructs observed

From `Structure/Lungs/Breathing.DES`:
- `<structure>`
- `<variables>`
- `<constant>`, `<parm>`, `<var>`
- `<curve>` with points and slopes
- `<block>`
- `<testcase>`, `<case>`, `<test>`
- `<def>`
- `<conditional>`
- `<copy>`
- `<call>`
- external symbol references such as `Ventilator.Rate`
- curve invocation syntax such as `DriveOnTidalVolume [ x ]`
- operators such as `MAX`, `GT`, `EQ`.

From `Structure/AcidBase/PhGeneral.DES`:
- ordered test cases;
- comparison operators `LE`, `LT`;
- function calls such as `LOG10`;
- exponentiation `^`;
- sentinel `TRUE`.

From `Structure/Lungs/PulmonaryMembrane.DES`:
- curve interpolation with explicit point slopes;
- same-name variable/function symbols;
- cross-structure references.

## Runtime layers to build

### 1. Preprocessor
Responsibilities:
- include expansion;
- create-token handling;
- path normalization (Windows separators);
- source-span preservation.

### 2. Structural parser
Produce an intermediate representation for:
- model;
- structure;
- variable declarations;
- constants/parameters;
- curves;
- blocks;
- definitions;
- conditionals;
- test cases;
- copy/call operations.

### 3. Expression parser
Support:
- arithmetic;
- comparisons;
- boolean constants;
- min/max language forms;
- functions;
- exponentiation;
- cross-structure symbol references;
- curve invocation.

### 4. Symbol table/dependency graph
Resolve:
- local symbols;
- `Structure.Variable` references;
- block calls;
- copy source/destination;
- same-name curves/variables.

### 5. Execution engine
Execute model math phases in source-preserved order.

Important: HumMod may depend on procedural block ordering rather than a purely topologically sorted algebraic graph. Do not reorder source operations until equivalence is demonstrated.

### 6. Dynamic-state solver
Inventory and reproduce the DES constructs that define derivatives, delays, integrators, and state updates.

This is expected to be the highest-risk part of the project.

### 7. State serialization
Provide deterministic save/restore with:
- HumMod source revision;
- runtime version;
- model time;
- all stateful variables;
- enabled create tokens;
- provenance map.

## First executable target

Do not start with the whole model.

Target a vertical slice containing:
1. `PhGeneral` — simple algebra + ordered testcase;
2. `Breathing` — testcase, conditional, copy/call, curve;
3. `PulmonaryMembrane` — curve interpolation and cross-structure references.

Then expand to a small cardiovascular/autonomic slice.

## Acceptance tests for the first slice

- parse all three source files without rewriting them;
- preserve exact source path/revision metadata;
- execute PhGeneral against known source equations;
- reproduce HumMod curve behavior after interpolation semantics are verified;
- record every runtime symbol's source;
- reject unsupported DES constructs explicitly rather than silently guessing.

## Key architectural insight

The runtime should use an intermediate representation rather than translating source text directly into ad hoc JavaScript. That gives us:

```
DES -> IR -> interpreter
          -> JS/TS generator
          -> provenance index
          -> dependency visualization
          -> static lint/audit
```

One parser can therefore support the runtime, browser generation, documentation, and provenance work.

## Immediate implementation

The first code spike in this branch implements a source-inspection parser for the structural subset needed to inventory these three files. It is intentionally not yet a solver and must fail on unsupported syntax rather than imply full HumMod compatibility.
