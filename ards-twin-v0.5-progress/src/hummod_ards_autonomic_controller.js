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

// Calibration anchor for the reduced hypercapnic-acidosis response.
// Stengl et al., Critical Care 2013, Table 2 (porcine, mechanically ventilated):
// hypercapnic acidosis pH 7.10; HR 99 -> 200/min; SVR 1412 -> 1068
// dyn*s/cm^5; PVR 259 -> 356 dyn*s/cm^5.
// The browser model uses this as a transparent challenge anchor, not as a
// claim of a universal human dose-response relationship.
const HYPERCAPNIC_ACIDOSIS_ANCHOR = Object.freeze({
  definitionPaco2MmHg: 45,
  definitionPh: 7.35,
  challengePh: 7.10,
  heartRateBaselinePerMin: 99,
  heartRateChallengePerMin: 200,
  svrBaseline: 1412,
  svrChallenge: 1068,
  pvrBaseline: 259,
  pvrChallenge: 356,
  citation: 'Stengl et al. Crit Care. 2013;17:R303.',
});

function hypercapnicAcidosisSeverity({ arterialPh, arterialPco2MmHg }) {
  finite(arterialPh, 'arterialPh');
  finite(arterialPco2MmHg, 'arterialPco2MmHg');
  if (arterialPco2MmHg <= HYPERCAPNIC_ACIDOSIS_ANCHOR.definitionPaco2MmHg ||
      arterialPh >= HYPERCAPNIC_ACIDOSIS_ANCHOR.definitionPh) return 0;
  return clamp(
    (HYPERCAPNIC_ACIDOSIS_ANCHOR.definitionPh - arterialPh) /
      (HYPERCAPNIC_ACIDOSIS_ANCHOR.definitionPh -
       HYPERCAPNIC_ACIDOSIS_ANCHOR.challengePh),
    0, 1);
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
    arterialPh = 7.40,
  } = {}) {
    positive(dtSec, 'dtSec');
    finite(meanArterialPressureMmHg, 'meanArterialPressureMmHg');

    // Low arterial pressure unloads baroreceptors and increases sympathetic
    // drive. Severe hypoxemia/hypercapnia add a modest chemoreflex component.
    const pressureError = targetMapMmHg - meanArterialPressureMmHg;
    const hypoxicDrive = clamp((70 - arterialPo2MmHg) / 45, 0, 1);
    const hypercapnicDrive = clamp((arterialPco2MmHg - 45) / 35, 0, 1);
    const hcaSeverity = hypercapnicAcidosisSeverity({
      arterialPh,
      arterialPco2MmHg,
    });
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
    const reflexHrTarget =
      baseline.heartRatePerMin + 55 * sympatheticTone - 22 * parasympatheticTone;
    const empiricalHcaHrRatio =
      HYPERCAPNIC_ACIDOSIS_ANCHOR.heartRateChallengePerMin /
      HYPERCAPNIC_ACIDOSIS_ANCHOR.heartRateBaselinePerMin;
    const empiricalHcaHrTarget = baseline.heartRatePerMin *
      (1 + hcaSeverity * (empiricalHcaHrRatio - 1));
    const hrTarget = clamp(
      Math.max(reflexHrTarget, empiricalHcaHrTarget),
      45, 200);
    heartRatePerMin = lag(heartRatePerMin, hrTarget, dtSec, cardiacTauSec);

    const contractilityTarget = clamp(
      (baseline.leftContractilityMultiplier || 1) *
      (0.88 + 0.72 * catecholamineDrive),
      0.7, 1.8);
    contractility = lag(contractility, contractilityTarget, dtSec, cardiacTauSec);

    // Alpha-mediated constriction and direct hypercapnic-acidosis vasodilation
    // are represented as competing effects. The latter is anchored to the
    // published HCA challenge above, in which SVR fell despite catecholaminergic
    // activation. Interpolation is explicit and bounded between normal and the
    // challenge state; it is not extrapolated beyond pH 7.10.
    const reflexArterialConductanceTarget =
      baseline.systemicArterialConductanceMlPerMinPerMmHg /
      (0.86 + 1.45 * sympatheticTone);
    const empiricalHcaConductanceRatio =
      HYPERCAPNIC_ACIDOSIS_ANCHOR.svrBaseline /
      HYPERCAPNIC_ACIDOSIS_ANCHOR.svrChallenge;
    const empiricalHcaConductanceTarget =
      baseline.systemicArterialConductanceMlPerMinPerMmHg *
      (1 + hcaSeverity * (empiricalHcaConductanceRatio - 1));
    const arterialConductanceTarget = hcaSeverity > 0
      ? Math.max(reflexArterialConductanceTarget, empiricalHcaConductanceTarget)
      : reflexArterialConductanceTarget;
    arterialConductance = lag(
      arterialConductance,
      arterialConductanceTarget,
      dtSec, vascularTauSec);

    // Venoconstriction recruits unstressed volume by lowering effective V0.
    const venousV0Target = baseVenousV0Ml * (1 - 0.14 * sympatheticTone);
    venousV0Ml = lag(venousV0Ml, venousV0Target, dtSec, vascularTauSec);

    // Positive intrathoracic pressure and hypoxemia remain independent
    // pulmonary loads. Hypercapnic acidemia adds an empirical resistance
    // multiplier anchored to the same Stengl challenge. Because resistance and
    // conductance are reciprocal, the HCA term lowers conductance.
    const pulmonaryLoad =
      0.018 * Math.max(0, thoracicPressureMmHg) + 0.28 * hypoxicDrive;
    const pressureHypoxiaConductance = 1 / (1 + pulmonaryLoad);
    const empiricalHcaPvrRatio = 1 + hcaSeverity * (
      HYPERCAPNIC_ACIDOSIS_ANCHOR.pvrChallenge /
      HYPERCAPNIC_ACIDOSIS_ANCHOR.pvrBaseline - 1);
    const hcaPulmonaryConductance = 1 / empiricalHcaPvrRatio;
    const pulmonaryTarget = clamp(
      pressureHypoxiaConductance * hcaPulmonaryConductance,
      0.45, 1.15);
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
      hypercapnicAcidosisSeverity: hcaSeverity,
      arterialPh,
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
        hypercapnicAcidosisAnchor: HYPERCAPNIC_ACIDOSIS_ANCHOR,
      }),
    });
  }

  return Object.freeze({ kind: 'hummod-ards-autonomic-controller', step, snapshot });
}

module.exports = {
  HYPERCAPNIC_ACIDOSIS_ANCHOR,
  hypercapnicAcidosisSeverity,
  createHumModArdsAutonomicController,
};
