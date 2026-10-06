# v1.3 Cardiac Contractility / Acidosis Audit

## Question

Could the inadequate extremis response be caused by myocardial contractility behavior during acidosis?

## HumMod source finding

Pinned HumMod models myocardial cellular pH explicitly:

- `LeftHeart-Ph.Ph` is calculated from myocardial CO2 and intracellular strong-ion difference, including myocardial lactate.
- `RightHeart-Ph.Ph` is calculated analogously.
- `LeftHeart-Function.PhEffect` and `RightHeart-Function.PhEffect` use a source curve that is 1.0 at pH 6.7 and 0 at pH 6.6.
- Heart-function effect also includes myocardial fuel availability, protein mass, temperature, and structure.

However, in the pinned HumMod ventricular pumping equations:

`LeftHeartPumping-Systole.Contractility = Contractility-Basic * LeftHeart-BetaReceptors.Activity`

and

`RightHeartPumping-Systole.Contractility = Contractility-Basic * RightHeart-BetaReceptors.Activity`.

The Heart-Function subsystem instead affects ventricular intrinsic rhythm and terminal failure:

- `Heart-Ventricles.IntrinsicRate = BasicRate * LeftHeart-Function.Effect`
- `Heart-Asystole.Is_Asystole = LeftHeart-Function.Failed`

For normal sinus rhythm without AV block, `Heart-Ventricles.Rate` follows `SANode-Rate.Rate`.

## v1.3 inconsistency found

The reduced runtime had also applied a literature-derived arterial-pH respiratory-acidosis multiplier directly to ventricular contractility. That multiplier is not part of the pinned HumMod ventricular systole equation and duplicated acidotic myocardial depression outside the source-aligned pumping chain.

## v1.3 correction

For `autonomicMode='source-aligned'`, the legacy arterial-pH contractility multiplier is no longer applied.

The reduced oxygen-debt/asphyxial decompensation model is unchanged. This remains an engineering collapse layer, not native HumMod.

## Extremis rerun after correction

Same challenge as the prior HR audit:

- FiO2 0.20
- PEEP 8 cmH2O
- RR 4/min
- VT 0.10 L

Results from the generated v1.3 browser engine:

- ~211 s: HR 85.9/min, MAP 80.1 mmHg, CO 5.17 L/min, pH 7.105, PaCO2 82.6 mmHg
- ~301 s: HR 86.5/min, MAP 79.1 mmHg, CO 5.18 L/min, pH 7.026, PaCO2 99.1 mmHg
- ~511 s: HR 87.2/min, MAP 78.0 mmHg, CO 5.08 L/min, pH 6.884, PaCO2 137.5 mmHg
- peak pre-arrest HR: 91.44/min
- terminal arrest: ~801 s in this run

Interpretation: removing the non-HumMod arterial-pH inotropy penalty substantially preserves cardiac output and pressure during severe hypercapnic acidemia, but does not correct the low HR ceiling. The inadequate tachycardia remains upstream in the autonomic/SA-node chain.

## Metabolic-acidosis implication

HumMod represents myocardial metabolic acidosis through intracellular cardiac pH and lactate/SID, not by applying arterial pH directly to ventricular contractility. Native myocardial fuel failure and `LeftHeart-Function` can ultimately trigger loss of intrinsic ventricular function/asystole, but the pinned systolic pump contractility equation itself remains beta-receptor driven.

Further work should therefore preserve separate concepts:

1. source-aligned beta-receptor inotropy for ventricular pumping;
2. native myocardial intracellular pH/fuel state for heart-function failure;
3. reduced oxygen-debt/asphyxial collapse only where explicitly labeled as an engineering bridge.

Do not add an arterial-pH-to-contractility curve to the source-aligned pumping path without a source change or an explicitly agreed non-HumMod model extension.
