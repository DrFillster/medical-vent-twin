'use strict';

// Reduced dynamic autonomic/hemodynamic controller for the browser ARDS core.
// This is a transparent engineering control layer inspired by HumMod control
// architecture; it is not a verbatim HumMod subsystem and is not clinically
// validated.

function finite(v, label) {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(label + ' must be finite');
  return v;
}
function positive(v, label) {
  finite(v, label); if (!(v > 0)) throw new Error(label + ' must be > 0'); return v;
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function lag(current, target, dtSec, tauSec) {
  return current + (target - current) * (1 - Math.exp(-dtSec / tauSec));
}

function createHumModArdsAutonomicController({
  baseline,
  targetMapMmHg = 82,
  baroreflexGain = 0.035,
  autonomicTauSec = 5,
  vascularTauSec = 8,
  cardiacTauSec = 4,
} = {}) {
  if (!baseline) throw new Error('baseline boundaries are required');
  positive(baseline.heartRatePerMin, 'baseline.heartRatePerMin');
  positive(baseline.systemicArterialConductanceMlPerMinPerMmHg,
    'baseline.systemicArterialConductanceMlPerMinPerMmHg');
  positive(baseline.systemicVenousConductanceMlPerMinPerMmHg,
    'baseline.systemicVenousConductanceMlPerMinPerMmHg');
  positive(targetMapMmHg, 'targetMapMmHg');

  const baseVenousV0Ml = baseline.systemicVenousV0Ml == null
    ? 1700
    : baseline.systemicVenousV0Ml;

  let sympatheticTone = 0.25;
  let parasympatheticTone = 0.45;
  let catecholamineDrive = 0.25;
  let heartRatePerMin = baseline.heartRatePerMin;
  let contractility = baseline.leftContractilityMultiplier || 1;
  let arterialConductance =
    baseline.systemicArterialConductanceMlPerMinPerMmHg;
  let venousV0Ml = baseVenousV0Ml;
  let pulmonaryConductanceMultiplier = 1;
  let last = null;

  function step({
    dtSec,
    meanArterialPressureMmHg,
    thoracicPressureMmHg = 0,
    arterialPo2MmHg = 90,
    arterialPco2MmHg = 40,
  } = {}) {
    positive(dtSec, 'dtSec');
    finite(meanArterialPressureMmHg, 'meanArterialPressureMmHg');

    // Low arterial pressure unloads baroreceptors and increases sympathetic
    // drive. Severe hypoxemia/hypercapnia add a modest chemoreflex component.
    const pressureError = targetMapMmHg - meanArterialPressureMmHg;
    const hypoxicDrive = clamp((70 - arterialPo2MmHg) / 45, 0, 1);
    const hypercapnicDrive = clamp((arterialPco2MmHg - 45) / 35, 0, 1);
    const reflexTarget = clamp(
      0.25 + baroreflexGain * pressureError +
      0.18 * hypoxicDrive + 0.10 * hypercapnicDrive,
      0, 1);

    sympatheticTone = lag(sympatheticTone, reflexTarget, dtSec, autonomicTauSec);
    parasympatheticTone = lag(
      parasympatheticTone,
      clamp(0.62 - 0.55 * sympatheticTone, 0.05, 0.75),
      dtSec, autonomicTauSec);
    catecholamineDrive = lag(
      catecholamineDrive,
      sympatheticTone,
      dtSec, cardiacTauSec);

    // Chronotropy and inotropy are separated from vascular tone so the model
    // can express reflex tachycardia, increased contractility, or predominantly
    // vasoconstrictor compensation.
    const hrTarget = clamp(
      baseline.heartRatePerMin +
      55 * sympatheticTone - 22 * parasympatheticTone,
      45, 165);
    heartRatePerMin = lag(heartRatePerMin, hrTarget, dtSec, cardiacTauSec);

    const contractilityTarget = clamp(
      (baseline.leftContractilityMultiplier || 1) *
      (0.88 + 0.72 * catecholamineDrive),
      0.7, 1.8);
    contractility = lag(contractility, contractilityTarget, dtSec, cardiacTauSec);

    // Alpha-mediated arteriolar constriction is represented by falling
    // conductance (therefore increasing SVR).
    const arterialConductanceTarget =
      baseline.systemicArterialConductanceMlPerMinPerMmHg /
      (0.86 + 1.45 * sympatheticTone);
    arterialConductance = lag(
      arterialConductance,
      arterialConductanceTarget,
      dtSec, vascularTauSec);

    // Venoconstriction recruits unstressed volume by lowering effective V0.
    const venousV0Target = baseVenousV0Ml * (1 - 0.14 * sympatheticTone);
    venousV0Ml = lag(venousV0Ml, venousV0Target, dtSec, vascularTauSec);

    // Positive intrathoracic pressure plus hypoxemia can increase pulmonary
    // vascular load. Represent this as lower pulmonary arterial conductance.
    const pulmonaryLoad =
      0.018 * Math.max(0, thoracicPressureMmHg) + 0.28 * hypoxicDrive;
    const pulmonaryTarget = clamp(1 / (1 + pulmonaryLoad), 0.55, 1.15);
    pulmonaryConductanceMultiplier = lag(
      pulmonaryConductanceMultiplier,
      pulmonaryTarget,
      dtSec, vascularTauSec);

    last = Object.freeze({
      targetMapMmHg,
      pressureErrorMmHg: pressureError,
      sympatheticTone,
      parasympatheticTone,
      catecholamineDrive,
      hypoxicDrive,
      hypercapnicDrive,
      heartRatePerMin,
      contractilityMultiplier: contractility,
      systemicArterialConductanceMlPerMinPerMmHg: arterialConductance,
      systemicVenousV0Ml: venousV0Ml,
      pulmonaryArterialConductanceMultiplier: pulmonaryConductanceMultiplier,
    });
    return snapshot();
  }

  function snapshot() {
    return Object.freeze({
      schema: 'hummod-ards-autonomic-controller/v1',
      ...(last || {
        targetMapMmHg,
        sympatheticTone,
        parasympatheticTone,
        catecholamineDrive,
        heartRatePerMin,
        contractilityMultiplier: contractility,
        systemicArterialConductanceMlPerMinPerMmHg: arterialConductance,
        systemicVenousV0Ml: venousV0Ml,
        pulmonaryArterialConductanceMultiplier: pulmonaryConductanceMultiplier,
      }),
      provenance: Object.freeze({
        status: 'reduced-dynamic-engineering-control-layer',
        clinicalValidation: false,
      }),
    });
  }

  return Object.freeze({ kind: 'hummod-ards-autonomic-controller', step, snapshot });
}

module.exports = { createHumModArdsAutonomicController };
