# v1.5 myocardial acidosis live-coupling gates

Date: 2026-10-11

## Objective

Connect the validated dynamic Shimayoshi respiratory-acidosis myocardial
surrogate to the live reduced HumMod/Vent model without substituting arterial
gases, nominal constants, or bedside-target tuning.

## Implemented and source-backed

### Shimayoshi cellular response

- pinned upstream:
  `atakeuti/TS-AT-SM-2026-IRmodel@6478d2ab0acbfc88d3da461d2594658bcb2798ca`
- validated fixed-step source grid;
- held-out 15% and 25% source validation;
- independent multistep dynamic source validation;
- two-state dynamic reduced-order source surrogate;
- held-out multistep maximum relative stress-ratio error < 0.9%;
- no HR/MAP/CO/SV/SVR target was used in fitting.

### HumMod-to-Shimayoshi CO2 bridge

HumMod myocardial `PCO2` is in mmHg.

Shimayoshi source `CO2o_p` is percent against the source 790 mmHg reference.

```
sourceEquivalentCO2Percent = 100 * myocardialPCO2_mmHg / 790
```

This is a dimensional mapping, not a fitted gain.

### HumMod myocardial chemistry primitives

Transcribed source-aligned components now include:

- myocardial SID algebra;
- myocardial CO2 mass balance;
- myocardial lactate mass balance;
- myocardial acid-base state;
- global KCell concentration algebra;
- KCell/KPool exchange algebra;
- LacPool concentration/mass-balance contract;
- LeftHeart-Size algebra;
- source-complete global tissue-water algebra where the upstream state is
  explicitly provided;
- blood SID + arterial HCO3 extraction from the existing reduced gas runtime.

## Live inputs already available

From `hummod-ards-core-gas-runtime`:

- `bloodSid = boundary.blood.sidMolPerL`
- `arterialHco3 = state.arterialHco3MolPerL`

No arterial PCO2 substitution is used.

## Live inputs still blocked

### 1. Intracellular potassium

Required:

```
KCell.[K+] = KCell.Mass / CellH2O.Vol
```

KCell/KPool exchange equations are transcribed, but live state still depends on
the broader HumMod potassium system, including delayed aldosterone and
extracellular potassium gains/losses.

### 2. Left-heart liquid volume

Required:

```
LeftHeart-Size.LiquidVol =
  LeftHeart-Size.IFV + LeftHeart-Size.CellH2O
```

The scaling algebra is transcribed, but current global tissue-water state
requires the HumMod capillary/lymph/regional-water system. A partial water
model is not substituted.

### 3. Lactate pool

Required:

```
LacPool.[Lac-] = LacPool.Mass / ECFV.Vol
```

LacPool mass is the sum of outfluxes from 12 tissue lactate models plus the
optional pump. The pool primitive is transcribed and fails closed when organ
outflows are incomplete.

### 4. Left-heart flow and metabolism

Source primitives exist, but a complete live provider still needs:

- myocardial blood-flow inputs;
- myocardial O2 need/use;
- source fuel partition;
- anaerobic glucose use;
- lactate use;
- upstream humoral/vascular states required by the myocardial-flow equation.

## LV-pressure timing gate

The reduced circulation exposes HumMod-style EDV and ESV.

The Kato/Utaki bridge requires LV volume corresponding to the source active
stress evaluation. Shimayoshi cycle peak `Fb` is not proven to occur exactly
at EDV or ESV.

Therefore EDV or ESV must **not** be silently substituted as the instantaneous
LV volume for source peak `Fb`.

The pressure bridge remains an explicit-volume shadow until phase-consistent
volume/stress coupling is defined.

## Current authority

The following remain true:

- dynamic Shimayoshi acidosis force: shadow only;
- Kato/Utaki LV pressure: shadow only;
- no Shimayoshi path modifies live HR;
- no Shimayoshi path modifies live SVR;
- no Shimayoshi path modifies live MAP/CO/SV;
- source-aligned HumMod pumping continues to exclude the legacy arterial-pH
  contractility penalty.

## Next implementation order

1. Complete the global state required for myocardial PCO2:
   KCell/KPool + water + LacPool dependencies.
2. Instantiate the stateful myocardial acid-base runtime.
3. Feed myocardial PCO2 through the dimensional HumMod/Shimayoshi bridge.
4. Run the validated two-state dynamic surrogate.
5. Validate phase-consistent cellular-force/LV-volume timing.
6. Only then evaluate whether the pressure shadow can enter the parallel
   circulation.
