# Shimayoshi source-model extraction protocol

Date: 2026-10-10
Status: ready for source execution

## Objective

Generate the myocardial active-stress response used to build the browser surrogate from the **original 2026 Shimayoshi/Takeuchi/Matsuoka equations**.

The source model has already been verified to include:
- a respiratory-acidosis protocol driven by extracellular CO2;
- an ischemia protocol that reduces extracellular O2;
- intracellular pH;
- intracellular O2;
- mitochondrial Complex IV / OXPHOS;
- ATP, phosphocreatine and phosphate;
- Ca handling;
- active cross-bridge force density `Fb`.

The published model reproduces contraction failure during ischemia-reperfusion and respiratory-acidosis behavior. citeturn372808search1turn372808search13

## Non-negotiable extraction rule

**Do not alter any physiologic equation or parameter to improve Vent behavior.**

Permitted source-run changes:
1. simulation duration;
2. protocol switch (control / respiratory acidosis / ischemia);
3. output directory;
4. output interval only after a fidelity comparison against the native 0.1 ms output-request cadence;
5. variables written to the compact result file.

## Required variables

```
time
Fb                  active cross-bridge stress / force density
Cyt_pHi             intracellular pH
ExtCell_O2o         extracellular O2 concentration
O2i                 intracellular O2
ATPTotal
PhosphoCreatine
PITotal
Cyt_Cai
```

The source index confirms:
- `IDX_Cyt_pHi = 5` in `v[]`
- `IDX_ExtCell_O2o = 9`
- `IDX_Fb = 128`
- `IDX_O2i = 64` in `Y[]`
- `IDX_ATPTotal = 35`
- `IDX_PhosphoCreatine = 36`

## Surrogate target

Fit the **source cellular active cross-bridge force `Fb`**. Preserve its absolute source units for the Kato/Utaki bridge. A normalized ratio may be retained as a diagnostic derivative:

```
stress_ratio(t) = peak_Fb(t) / reference_control_peak_Fb
```

The surrogate may depend on source-model physiologic states/inputs but **must not be fit against HR, MAP, CO, SV or SVR**.

## Validation

Hold out complete trajectories, not randomly interspersed time points.

Minimum acceptance checks:
- baseline ratio returns approximately 1 by construction;
- respiratory acidosis produces the source model's depression/recovery trajectory;
- oxygen limitation does not produce an instantaneous PaO2-style step penalty;
- severe source-model energy failure produces progressive stress loss;
- combined future perturbations remain bounded;
- browser surrogate residuals and maximum error are documented.

No numeric error threshold is imposed until the first source grid is available; choosing one now would be arbitrary.

## Whole-heart mapping

Primary path:

```
source Shimayoshi peak Fb
    -> published Kato/Utaki K_S cell-to-wall scaling
    -> active wall stress + published passive wall stress
    -> Kato/Utaki LV geometry
    -> LV pressure
    -> closed-loop circulation
    -> physician-facing SV / CO / MAP
```

CircAdapt/TriSeg remains an independent comparison/shadow architecture. It is
not the primary adapter for the source-derived Shimayoshi myocardial force.

No whole-heart parameter is fit to HR, MAP, CO, SV, or SVR.
