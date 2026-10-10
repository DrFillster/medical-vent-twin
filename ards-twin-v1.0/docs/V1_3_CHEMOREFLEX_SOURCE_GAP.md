# v1.3 chemoreflex source-gap audit

## Decision

Do not add a direct hypoxia-to-HR or DO2-to-HR gain.

The current browser runtime may accept an explicit `sympsChemoEffectProvider`, but the
default remains `SympsChemo.Effect = 1.0`, matching the pinned standalone HumMod
source. A non-neutral provider must be backed by a recoverable source equation or a
separately reviewed/validated extension.

## Native run07 finding

The high-resolution Mac HumMod run07 demonstrates that the old standalone model
strongly senses hypoxemia but weakly transmits that signal to central sympathetic
outflow:

- baseline chemoreceptor firing about 1.15
- severe hypoxemia chemoreceptor firing about 10.9
- SympsCNS rises only to about 2.02 Hz
- peak native HR about 84.7/min despite PaO2 about 15.6 mmHg
- when Brain-Function fails, SympsCNS returns near 1.5 Hz and HR returns near 72/min

Therefore the principal source limitation is upstream of the SA node, not an
insufficient SA-node chronotropic range.

## Standalone HumMod

Pinned reproducibility source:
`riliescu/hummod-standalone@8dab57e05631f779bf5020fe0dd51874d8ae98c1`

Relevant source behavior:
- `Chemoreceptors` responds to PaO2 and pH.
- `SympsChemo.Effect` is fixed at 1.0.
- `SympsCNS.ReflexNA` contains a SympsChemo factor in the model architecture.
- SA-node sympathetic response has ample range when beta-receptor activity rises.

## HumMod 1.6.1-derived Physiomodel

The public Physiomodel project states that its first version integrates HumMod 1.6.1.
Its published/default state also contains `SympsChemo.Effect = 1.0`.

This means Physiomodel does not currently provide evidence for a non-neutral
chemoreceptor-to-SympsCNS transfer equation that can be ported verbatim.

## QCP historical evidence

The public QCP predecessor state contains an explicit historical
`Chemos -> Symp's` subsystem, including:

- onset-delay tau = 5 min
- adaptation-delay tau = 15 min
- dynamic onset-delay state
- dynamic adaptation-delay state

However, the indexed public state file does not establish the algebraic transfer
function from chemoreceptor activity to these delay targets or to final sympathetic
effect. The time constants alone are insufficient to reconstruct the model safely.

## Implementation rule

The current v1.3 insertion point is deliberately neutral:

```
SympsCNS.ReflexNA =
  BaroEffect *
  LowPressureEffect *
  MechanoEffect *
  SympsChemo.Effect
```

Browser implementation currently retains the source-equivalent MechanoEffect = 1
and defaults SympsChemo.Effect = 1.

Any future non-neutral implementation must:

1. enter at `SympsChemo.Effect`, not final HR;
2. preserve the native downstream cascade:
   SympsCNS -> ganglia -> vagus/beta receptors -> SA node/contractility;
3. state its exact source and version;
4. distinguish a HumMod/QCP-derived equation from an external physiology extension;
5. pass the run07-style fidelity harness;
6. remain disabled if the transfer equation cannot be verified.

## Deployment note

CI validation for commit `d5b4567267ba4f79e624ed5475243cd733b1136a`
passed build, focused HumMod fidelity tests, the full Node suite, deploy verification,
and browser smoke. The workflow failed only in live-origin smoke because the public
v1.3 preview path/source marker returned 404 while the site root returned 200.

That deployment problem must not be interpreted as a physiology-test failure.
