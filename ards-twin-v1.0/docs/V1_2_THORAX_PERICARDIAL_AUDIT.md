# v1.2 Thorax and Pericardial Coupling Audit

## Finding

The official HumMod model and the current Vent clinical twin do not define the same thoracic mechanics problem.

### HumMod thorax

In the pinned reproducibility mirror of the official HumMod source:

- `RightHemithorax.NormalPressure = -4.0 mmHg`
- `LeftHemithorax.NormalPressure = -4.0 mmHg`
- closed-chest hemithorax pressure is assigned to that normal pressure;
- `Thorax.AvePressure` is the average of right and left hemithorax pressure.

The source does **not** provide a mechanical-ventilation airway-pressure-to-pleural-pressure transmission law.

Therefore the Vent live bridge:

`dPpl = dPaw * Ecw/Ers`

must remain classified as an engineering coupling assumption. It must not be relabeled as source-preserved HumMod physiology.

## Pericardium

HumMod does provide a source pericardial pressure model.

`Pericardium-Cavity.Pressure = Thorax.AvePressure + Pericardium-TMP.Pressure`

and:

`Pericardium-TMP.Pressure = 0`

when the pericardium is open or total enclosed volume is below `Pericardium-V0.Vol`; otherwise:

`TMP = exp(0.015 * (Pericardium.TotalVol - Pericardium-V0.Vol)) - 1`

The source `Pericardium.TotalVol` includes:

- right-heart tissue volume;
- right atrial volume;
- right ventricular volume;
- left-heart tissue volume;
- left atrial volume;
- left ventricular volume;
- pericardial cavity volume.

## Why v1.2 does not activate source pericardial TMP yet

The reduced live circulation does not carry all of those source states. In particular, it does not presently maintain the complete heart-tissue and pericardial-cavity volume state required to reproduce `Pericardium.TotalVol`.

Using only atrial/ventricular blood volumes would silently change the HumMod equation.

## Required boundary for activation

A future native calibration/export should track at least:

- `Pericardium.TotalVol`
- `Pericardium-V0.Vol`
- `Pericardium-Cavity.Vol`
- right/left ventricular volume state as needed for dynamic reconstruction.

A reduced dynamic adapter may then derive a fixed non-chamber volume offset from a native initialized state and update total enclosed volume from the reduced chamber state, but that adapter must be separately validated and labeled `HUMMOD_ADAPTED`.

## v1.2 authority decision

For the current v1.2 milestone:

- Vent retains authority for airway pressure and PEEP mechanics.
- The airway-to-pleural bridge remains an explicit engineering assumption.
- Pericardial TMP remains the existing explicit boundary rather than being replaced with a partial HumMod formula.
- No claim of full HumMod thoracic/pericardial coupling is made.

This is preferable to introducing a numerically plausible but source-incomplete pericardial model.
