# HumMod -> Shimayoshi myocardial CO2 bridge

Date: 2026-10-11

This bridge is dimensional and diagnostic. It is **not** a fitted
contractility gain and it has no closed-loop control authority.

## HumMod source

Pinned source:

`riliescu/hummod-standalone@8dab57e05631f779bf5020fe0dd51874d8ae98c1`

HumMod myocardial CO2 state:
- `Structure/LeftHeart/LeftHeart-CO2.DES`
- output: `LeftHeart-CO2.PCO2`

HumMod display evidence:
- `Display/Physiology/CO2/Blood/Artys.DES`
- normal arterial `pCO2 = 41.0 mmHg`

The tissue CO2 display includes `LeftHeart-CO2.PCO2` in the same PCO2
display family.

## Shimayoshi source

Pinned source:

`atakeuti/TS-AT-SM-2026-IRmodel@6478d2ab0acbfc88d3da461d2594658bcb2798ca`

The source defines:

```cpp
const double alpha_CO2 = 24.7228; // solubility of CO2 at 790 mmHg
double CO2o_p = 5.0;              // extracellular CO2 %
```

and drives extracellular dissolved CO2 toward:

```cpp
alpha_CO2 * CO2o_p / 100.0
```

## Dimensional mapping

Using the Shimayoshi source reference total pressure:

```
source_CO2_fraction = HumMod_myocardial_PCO2_mmHg / 790_mmHg

source_CO2_percent =
    100 * HumMod_myocardial_PCO2_mmHg / 790_mmHg
```

This is a pressure-fraction conversion only.

For a consistency check, Shimayoshi's 5% control input corresponds to
39.5 mmHg at 790 mmHg total pressure, close to HumMod's displayed normal
arterial PCO2 of 41.0 mmHg. This is **not** used as a fitted calibration.

## Important limitation

The variables are not biologically identical merely because their dimensions
can be converted:

- HumMod supplies a modeled myocardial tissue PCO2 state.
- Shimayoshi applies an extracellular CO2 gas-percent boundary condition.

Therefore the bridge remains shadow-only until the composite response is
validated against an appropriate cross-model protocol.

No arterial-pH-to-contractility rule is introduced.
