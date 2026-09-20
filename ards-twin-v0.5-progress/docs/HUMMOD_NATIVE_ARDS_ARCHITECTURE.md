# Native HumMod ARDS integration decision

Status: workbench engineering decision; not clinical validation.

## What the pinned native HumMod runtime can provide

The verified Windows path can load the upstream model, advance it, save a native `SOLN`, reload a modified `SOLN`, and re-export systemic/gas physiology. Source inspection also confirms native controls for ventilator on/off, respiratory rate, tidal volume, and inspired-gas composition.

## Important native limitation

The pinned HumMod ventilator does not expose PEEP. Vent remains the authoritative mechanical model for PEEP, recruitment/derecruitment, compartment mechanics, holds, plateau pressure, total PEEP, driving pressure, and waveforms.

Therefore a native HumMod pulmonary-injury sweep must **not** be labeled a Berlin ARDS classification run. The sweep is used to identify and calibrate systemic/gas-exchange sensitivity of source-native HumMod pulmonary mechanisms. Berlin-case qualification remains a separate gate that requires the Vent mechanical context and the project's evidence-backed clinical calibration workflow.

## Integration architecture

1. **Vent:** persistent mechanical lung state and ventilator interventions.
2. **Native HumMod:** upstream systemic/gas physiology reference experiments and calibration evidence.
3. **Reduced HumMod core:** browser-capable live coupling layer, compared against native HumMod rather than presented as full HumMod.
4. **Case layer:** synthetic Berlin teaching cases remain explicitly synthetic until both mechanical and systemic calibration gates are satisfied.

## Current one-shot experiment

The workbench sweep fixes ventilation and the complete native inspired-gas mixture across all cases, varies only whitelisted pulmonary/thoracic mechanisms, and records exact scenario assignments in the re-exported SOLN. The parser rejects a run if a requested assignment is missing or not preserved after native HumMod reload/advance.

The output is an engineering sensitivity report. It intentionally does not calculate or assign a Berlin category.

## Native-to-browser calibration gate

The same one-shot experiment now generates a native HumMod endpoint target and runs a reduced-core alignment probe under matched FiO2, respiratory-rate, and tidal-volume controls. It then emits an explicit native-vs-reduced discrepancy report for PaO2, PaCO2, pH, heart rate, systemic arterial pressure, and cardiac output.

This comparison is diagnostic rather than an equivalence test. The native baseline has no PEEP control and no Vent Berlin-case mechanics, whereas the reduced probe uses the project's synthetic ARDS mechanical model. Absolute discrepancies therefore identify calibration work but cannot by themselves validate or invalidate the ARDS case.

The intended progression is:

1. verify native HumMod perturbations and their systemic/gas response;
2. identify source-native mechanisms suitable for ARDS calibration;
3. calibrate the reduced core against native response direction and magnitude where model boundaries can be matched;
4. combine the calibrated systemic layer with Vent's PEEP/recruitment mechanics;
5. only then evaluate the synthetic cases against explicit Berlin/evidence gates.

No automatic numerical tolerance is allowed to promote the reduced core to "full HumMod equivalent."

## Distribution constraint

No upstream HumMod executable or model source is committed to this repository. The upstream standalone repository does not expose an obvious license file at the pinned revision, so redistribution or publication of modified upstream assets remains blocked pending rights verification.
