'use strict';

// Progressive shock/decompensation controller for the reduced browser core.
//
// This layer intentionally uses physiologically interpretable state:
//   oxygen debt (mL O2) = integral of unmet aerobic O2 demand over time.
// It is NOT a mortality prediction model and is NOT a verbatim HumMod module.
//
// Calibration anchors:
// - End-compensation oxygen extraction ~55% (SvO2 ~45%) during progressive
//   central hypovolemia/hemorrhage.
// - Mean cardiovascular-collapse time 35 +/- 11 min in fixed-rate porcine
//   hemorrhage (Navarro e Lima et al., J Trauma Acute Care Surg 2012).
// - Severe shock/lactic acidosis depressed myocardial elastance from ~2.87
//   to ~0.50 mmHg/uL in an experimental model (Kimmoun et al.,
//   Anesthesiology 2013); ratio ~= 0.17.
// - Cardiovascular collapse definition from Gomez et al.:
//   MAP <30 mmHg for 10 min or MAP <20 mmHg for 10 sec.
//
// The 35-minute collapse time is used only to normalize accumulated oxygen
// debt into a bounded severe-shock injury signal. It is not claimed to be a
// universal human survival time or a patient-specific death threshold.

const END_COMPENSATION_SVO2_FRACTION = 0.45;
const ORGAN_FLOW_RISK_MAP_MMHG = 50;
const COLLAPSE_CALIBRATION_EQUIVALENT_DEBT_MIN = 35;
const MYOCARDIAL_CONTRACTILITY_FLOOR = 0.50 / 2.87;
const CARDIOVASCULAR_COLLAPSE_MAP_MMHG = 30;
const CARDIOVASCULAR_COLLAPSE_MAP_SEC = 10 * 60;
const PROFOUND_COLLAPSE_MAP_MMHG = 20;
const PROFOUND_COLLAPSE_MAP_SEC = 10;

function finite(v, label) {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error(label + ' must be finite');
  }
  return v;
}
function nonNegative(v, label) {
  finite(v, label);
  if (v < 0) throw new Error(label + ' must be >= 0');
  return v;
}
function positive(v, label) {
  finite(v, label);
  if (!(v > 0)) throw new Error(label + ' must be > 0');
  return v;
}
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function classifyStage({
  cardiacArrest,
  equivalentDebtMinutes,
  svo2Fraction,
  mapMmHg,
  oxygenSupplyDeficitMlPerMin,
}) {
  if (cardiacArrest) return 'cardiac-arrest';
  if (equivalentDebtMinutes >= COLLAPSE_CALIBRATION_EQUIVALENT_DEBT_MIN) {
    return 'refractory-shock';
  }
  if (equivalentDebtMinutes >= COLLAPSE_CALIBRATION_EQUIVALENT_DEBT_MIN * 0.5) {
    return 'decompensated-shock';
  }
  if (oxygenSupplyDeficitMlPerMin > 0) return 'oxygen-debt';
  if (svo2Fraction < END_COMPENSATION_SVO2_FRACTION ||
      mapMmHg < ORGAN_FLOW_RISK_MAP_MMHG) {
    return 'compensated-shock';
  }
  return 'stable';
}

function createHumModArdsDecompensationController() {
  let oxygenDebtMl = 0;
  let lowMapBelow30Sec = 0;
  let lowMapBelow20Sec = 0;
  let cardiacArrest = false;
  let last = null;

  function step({
    dtSec,
    meanArterialPressureMmHg,
    mixedVenousO2SaturationFraction,
    requestedTissueO2UseMlPerMin,
    oxygenSupplyDeficitMlPerMin,
  } = {}) {
    positive(dtSec, 'dtSec');
    finite(meanArterialPressureMmHg, 'meanArterialPressureMmHg');
    finite(mixedVenousO2SaturationFraction,
      'mixedVenousO2SaturationFraction');
    positive(requestedTissueO2UseMlPerMin,
      'requestedTissueO2UseMlPerMin');
    nonNegative(oxygenSupplyDeficitMlPerMin,
      'oxygenSupplyDeficitMlPerMin');

    if (!cardiacArrest) {
      oxygenDebtMl += oxygenSupplyDeficitMlPerMin * (dtSec / 60);

      lowMapBelow30Sec = meanArterialPressureMmHg <
        CARDIOVASCULAR_COLLAPSE_MAP_MMHG
        ? lowMapBelow30Sec + dtSec
        : 0;
      lowMapBelow20Sec = meanArterialPressureMmHg <
        PROFOUND_COLLAPSE_MAP_MMHG
        ? lowMapBelow20Sec + dtSec
        : 0;

      if (lowMapBelow30Sec >= CARDIOVASCULAR_COLLAPSE_MAP_SEC ||
          lowMapBelow20Sec >= PROFOUND_COLLAPSE_MAP_SEC) {
        cardiacArrest = true;
      }
    }

    const equivalentDebtMinutes =
      oxygenDebtMl / requestedTissueO2UseMlPerMin;
    const metabolicFailureFraction = clamp(
      equivalentDebtMinutes /
        COLLAPSE_CALIBRATION_EQUIVALENT_DEBT_MIN,
      0, 1);

    // Bounded myocardial depression calibrated to the severe-shock elastance
    // ratio above. This is deliberately applied to contractility, not HR, so
    // catecholaminergic tachycardia can coexist with progressive pump failure.
    const myocardialContractilityMultiplier =
      1 - metabolicFailureFraction *
        (1 - MYOCARDIAL_CONTRACTILITY_FLOOR);

    const stage = classifyStage({
      cardiacArrest,
      equivalentDebtMinutes,
      svo2Fraction: mixedVenousO2SaturationFraction,
      mapMmHg: meanArterialPressureMmHg,
      oxygenSupplyDeficitMlPerMin,
    });

    last = Object.freeze({
      stage,
      alive: !cardiacArrest,
      cardiacArrest,
      oxygenDebtMl,
      equivalentDebtMinutes,
      metabolicFailureFraction,
      myocardialContractilityMultiplier,
      mixedVenousO2SaturationFraction,
      meanArterialPressureMmHg,
      lowMapBelow30Sec,
      lowMapBelow20Sec,
      endCompensationSvo2Fraction:
        END_COMPENSATION_SVO2_FRACTION,
    });
    return snapshot();
  }

  function snapshot() {
    return Object.freeze(last || {
      stage: 'stable',
      alive: true,
      cardiacArrest: false,
      oxygenDebtMl,
      equivalentDebtMinutes: 0,
      metabolicFailureFraction: 0,
      myocardialContractilityMultiplier: 1,
      lowMapBelow30Sec,
      lowMapBelow20Sec,
      endCompensationSvo2Fraction:
        END_COMPENSATION_SVO2_FRACTION,
    });
  }

  return Object.freeze({
    kind: 'hummod-ards-decompensation-controller',
    step,
    snapshot,
  });
}

module.exports = {
  END_COMPENSATION_SVO2_FRACTION,
  ORGAN_FLOW_RISK_MAP_MMHG,
  COLLAPSE_CALIBRATION_EQUIVALENT_DEBT_MIN,
  MYOCARDIAL_CONTRACTILITY_FLOOR,
  CARDIOVASCULAR_COLLAPSE_MAP_MMHG,
  CARDIOVASCULAR_COLLAPSE_MAP_SEC,
  PROFOUND_COLLAPSE_MAP_MMHG,
  PROFOUND_COLLAPSE_MAP_SEC,
  createHumModArdsDecompensationController,
};
