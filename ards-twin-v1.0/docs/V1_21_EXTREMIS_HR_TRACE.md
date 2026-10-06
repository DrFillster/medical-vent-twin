# v1.21 Extremis Heart-Rate Trace

## Reproduced behavior

The generated v1.21 browser engine reproduces the reported under-tachycardia.

Using the existing extremis challenge:

- FiO2 0.20
- PEEP 8 cmH2O
- RR 4/min
- VT 0.10 L

the source-aligned sinus rate peaks at approximately **91.22/min** before later cardiovascular collapse.

At the peak-HR sample (patient time 291 s):

- HR: 91.22/min
- MAP: 54.40 mmHg
- cardiac output: 3166 mL/min
- PaO2: 16.44 mmHg
- PaCO2: 111.94 mmHg
- pH: 6.973
- baroreflex NA: 0.0428
- SympsCNS NA: 1.5379
- SympsCNS firing: 2.3069 Hz
- vagus firing: 0.7813 Hz
- SA-node beta activity: 1.3091
- parasympathetic HR effect: -5.28/min
- sympathetic HR effect: +14.50/min
- norepinephrine: 310.5 pg/mL
- epinephrine: 44.5 pg/mL

The displayed HR equals the source-aligned SA-node HR before arrest. Therefore the 91/min ceiling is upstream of display logic and is not caused by the removed project chronotropic-reserve multiplier.

## First localized bottleneck

The current reduced controller computes:

`SympsCNS.NA = ReflexNA`

where `ReflexNA = BaroEffect * LowPressureEffect * MechanoEffect * SympsChemo.Effect`.

Official HumMod does **not** stop there. In `Structure/Nerves/SympsCNS.DES`, when brain function is preserved:

`NA = (ReflexNA + ExerciseSymps.TotalEffect + CushingResponse.Effect + FuelEffect) * A2Effect * CNSTrophicFactor.Effect`

v1.21 currently neutralizes the following terms:

- `ExerciseSymps.TotalEffect`
- `CushingResponse.Effect`
- `FuelEffect` from `Brain-Fuel.FractUseDelay`
- `A2Effect` from `A2Pool.Log10Conc`
- `CNSTrophicFactor.Effect`

The official SANode equations used downstream are already represented correctly in v1.21:

- beta-receptor activity = 0.333 * GangliaGeneral.NA(Hz) + 0.5 * BetaPool.Effect
- sinus rate = BasicRate + parasympathetic effect + sympathetic effect

## Interpretation

The present defect is an **incomplete HumMod CNS sympathetic input set**, not evidence that the SA-node gain should be increased.

The next physiology change should therefore be source-driven:

1. obtain native HumMod values for Brain-Fuel.FractUseDelay, A2Pool.Log10Conc, CNSTrophicFactor.Effect, and CushingResponse.Effect during the same extremis trajectory;
2. identify which term first diverges from the reduced runtime;
3. port the required upstream dependencies from HumMod;
4. compare v1.21 against the native trace before changing any additional physiology.

Do not substitute PaO2, MAP, oxygen debt, or another project-authored proxy for these HumMod variables.
