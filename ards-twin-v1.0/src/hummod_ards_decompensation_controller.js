'use strict';

// Progressive shock/decompensation controller for the reduced browser core.
//
// This layer intentionally uses physiologically interpretable state:
//   oxygen debt (mL O2) = integral of unmet aerobic O2 demand over time.
// It is NOT a mortality prediction model and is NOT a verbatim HumMod module.
//
// Calibration anchors:
// - A low-SvO2 shock marker of 45% is used only as an engineering warning
//   signal inside the published 30-50% range associated with critical oxygen
//   delivery / depleted extraction reserve. It is not a universal clinical
//   decompensation threshold.
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

const LOW_SVO2_SHOCK_MARKER_FRACTION = 0.45;
const ORGAN_FLOW_RISK_MAP_MMHG = 50;
const COLLAPSE_CALIBRATION_EQUIVALENT_DEBT_MIN = 35;
const MYOCARDIAL_CONTRACTILITY_FLOOR = 0.50 / 2.87;
const CARDIOVASCULAR_COLLAPSE_MAP_MMHG = 30;
const CARDIOVASCULAR_COLLAPSE_MAP_SEC = 10 * 60;
const PROFOUND_COLLAPSE_MAP_MMHG = 20;
const PROFOUND_COLLAPSE_MAP_SEC = 10;

// DeBehnke et al. standardized canine asphyxia model:
// HR peaked at 2-3 min, systolic pressure peaked at 7 min, and aortic
// pulsations were lost at 11.4 +/- 2.4 min. At loss of pulsations,
// pH 7.03 +/- 0.07, PaCO2 93 +/- 19, PaO2 12 +/- 7 mmHg.
// We do not use those gases as a deterministic death threshold. Instead,
// severe respiratory acidosis gates the rate at which an already measured
// oxygen-supply deficit accumulates an asphyxial-collapse clock.
const ASPHYXIAL_COLLAPSE_ANCHOR = Object.freeze({
  compensatoryPressurePeakMin: 7,
  meanLossOfAorticPulsationsMin: 11.4,
  arterialPhAtCollapse: 7.03,
  arterialPco2AtCollapseMmHg: 93,
  normalPhReference: 7.35,
  normalPco2ReferenceMmHg: 45,
  terminalRhythm: 'PEA',
  citation:
    'DeBehnke et al. Resuscitation. 1995;30:169-175. doi:10.1016/0300-9572(95)00873-R',
});

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
  if (svo2Fraction < LOW_SVO2_SHOCK_MARKER_FRACTION ||
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
  let cardiacArrestReason = null;
  let arrestRhythm = null;
  let asphyxialEquivalentMinutes = 0;
  let last = null;

  function step({
    dtSec,
    meanArterialPressureMmHg,
    mixedVenousO2SaturationFraction,
    requestedTissueO2UseMlPerMin,
    oxygenSupplyDeficitMlPerMin,
    arterialPh = 7.40,
    arterialPco2MmHg = 40,
    deliveryToCriticalRatio = Infinity,
  } = {}) {
    positive(dtSec, 'dtSec');
    finite(meanArterialPressureMmHg, 'meanArterialPressureMmHg');
    finite(mixedVenousO2SaturationFraction,
      'mixedVenousO2SaturationFraction');
    positive(requestedTissueO2UseMlPerMin,
      'requestedTissueO2UseMlPerMin');
    nonNegative(oxygenSupplyDeficitMlPerMin,
      'oxygenSupplyDeficitMlPerMin');
    finite(arterialPh, 'arterialPh');
    nonNegative(arterialPco2MmHg, 'arterialPco2MmHg');
    if (!(deliveryToCriticalRatio === Infinity ||
          (typeof deliveryToCriticalRatio === 'number' &&
           Number.isFinite(deliveryToCriticalRatio) &&
           deliveryToCriticalRatio >= 0))) {
      throw new Error('deliveryToCriticalRatio must be >= 0 or Infinity');
    }

    const requested = requestedTissueO2UseMlPerMin;
    const supplyDeficitFraction = requested > 0
      ? clamp(oxygenSupplyDeficitMlPerMin / requested, 0, 1)
      : 0;
    const co2Severity = clamp(
      (arterialPco2MmHg - ASPHYXIAL_COLLAPSE_ANCHOR.normalPco2ReferenceMmHg) /
      (ASPHYXIAL_COLLAPSE_ANCHOR.arterialPco2AtCollapseMmHg -
       ASPHYXIAL_COLLAPSE_ANCHOR.normalPco2ReferenceMmHg),
      0, 1);
    const acidSeverity = clamp(
      (ASPHYXIAL_COLLAPSE_ANCHOR.normalPhReference - arterialPh) /
      (ASPHYXIAL_COLLAPSE_ANCHOR.normalPhReference -
       ASPHYXIAL_COLLAPSE_ANCHOR.arterialPhAtCollapse),
      0, 1);
    const respiratoryAcidosisSeverity = Math.max(co2Severity, acidSeverity);
    const asphyxialBurdenRate =
      supplyDeficitFraction * respiratoryAcidosisSeverity;

    if (!cardiacArrest) {
      oxygenDebtMl += oxygenSupplyDeficitMlPerMin * (dtSec / 60);
      asphyxialEquivalentMinutes +=
        asphyxialBurdenRate * (dtSec / 60);

      lowMapBelow30Sec = meanArterialPressureMmHg <
        CARDIOVASCULAR_COLLAPSE_MAP_MMHG
        ? lowMapBelow30Sec + dtSec
        : 0;
      lowMapBelow20Sec = meanArterialPressureMmHg <
        PROFOUND_COLLAPSE_MAP_MMHG
        ? lowMapBelow20Sec + dtSec
        : 0;

      if (asphyxialEquivalentMinutes >=
          ASPHYXIAL_COLLAPSE_ANCHOR.meanLossOfAorticPulsationsMin) {
        cardiacArrest = true;
        cardiacArrestReason = 'asphyxial-oxygen-delivery-collapse';
        arrestRhythm = ASPHYXIAL_COLLAPSE_ANCHOR.terminalRhythm;
      } else if (lowMapBelow30Sec >= CARDIOVASCULAR_COLLAPSE_MAP_SEC ||
          lowMapBelow20Sec >= PROFOUND_COLLAPSE_MAP_SEC) {
        cardiacArrest = true;
        cardiacArrestReason = 'sustained-profound-hypotension';
        arrestRhythm = 'PEA';
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
    const debtMyocardialContractilityMultiplier =
      1 - metabolicFailureFraction *
        (1 - MYOCARDIAL_CONTRACTILITY_FLOOR);

    // The asphyxial model demonstrates a compensated phase followed by a
    // relatively abrupt circulatory failure. We preserve full reserve until
    // the observed pressure peak and then interpolate to loss of mechanical
    // reserve at the observed mean loss-of-pulsations time. This interpolation
    // is an explicit engineering bridge between measured time landmarks, not
    // a fitted human mortality curve.
    const asphyxialReserveMultiplier =
      asphyxialEquivalentMinutes <=
        ASPHYXIAL_COLLAPSE_ANCHOR.compensatoryPressurePeakMin
        ? 1
        : clamp(
            (ASPHYXIAL_COLLAPSE_ANCHOR.meanLossOfAorticPulsationsMin -
             asphyxialEquivalentMinutes) /
            (ASPHYXIAL_COLLAPSE_ANCHOR.meanLossOfAorticPulsationsMin -
             ASPHYXIAL_COLLAPSE_ANCHOR.compensatoryPressurePeakMin),
            0, 1);
    const myocardialContractilityMultiplier =
      debtMyocardialContractilityMultiplier * asphyxialReserveMultiplier;
    const chronotropicReserveMultiplier = asphyxialReserveMultiplier;

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
      cardiacArrestReason,
      arrestRhythm,
      oxygenDebtMl,
      equivalentDebtMinutes,
      metabolicFailureFraction,
      debtMyocardialContractilityMultiplier,
      myocardialContractilityMultiplier,
      chronotropicReserveMultiplier,
      asphyxialReserveMultiplier,
      asphyxialEquivalentMinutes,
      asphyxialBurdenRate,
      respiratoryAcidosisSeverity,
      supplyDeficitFraction,
      deliveryToCriticalRatio,
      mixedVenousO2SaturationFraction,
      meanArterialPressureMmHg,
      lowMapBelow30Sec,
      lowMapBelow20Sec,
      lowSvo2ShockMarkerFraction:
        LOW_SVO2_SHOCK_MARKER_FRACTION,
    });
    return snapshot();
  }

  function forceArrest({
    reason = 'mechanical-pump-failure',
    rhythm = 'PEA',
  } = {}) {
    cardiacArrest = true;
    cardiacArrestReason = reason;
    arrestRhythm = rhythm;
    const prior = snapshot();
    last = Object.freeze({
      ...prior,
      stage: 'cardiac-arrest',
      alive: false,
      cardiacArrest: true,
      cardiacArrestReason,
      arrestRhythm,
      myocardialContractilityMultiplier: 0,
      chronotropicReserveMultiplier: 0,
      asphyxialReserveMultiplier: Math.min(
        prior.asphyxialReserveMultiplier == null
          ? 1
          : prior.asphyxialReserveMultiplier,
        0),
    });
    return snapshot();
  }

  function snapshot() {
    return Object.freeze(last || {
      stage: 'stable',
      alive: true,
      cardiacArrest: false,
      cardiacArrestReason,
      arrestRhythm,
      oxygenDebtMl,
      equivalentDebtMinutes: 0,
      metabolicFailureFraction: 0,
      debtMyocardialContractilityMultiplier: 1,
      myocardialContractilityMultiplier: 1,
      chronotropicReserveMultiplier: 1,
      asphyxialReserveMultiplier: 1,
      asphyxialEquivalentMinutes,
      asphyxialBurdenRate: 0,
      respiratoryAcidosisSeverity: 0,
      supplyDeficitFraction: 0,
      deliveryToCriticalRatio: Infinity,
      lowMapBelow30Sec,
      lowMapBelow20Sec,
      lowSvo2ShockMarkerFraction:
        LOW_SVO2_SHOCK_MARKER_FRACTION,
    });
  }

  return Object.freeze({
    kind: 'hummod-ards-decompensation-controller',
    step,
    forceArrest,
    snapshot,
  });
}

module.exports = {
  LOW_SVO2_SHOCK_MARKER_FRACTION,
  ORGAN_FLOW_RISK_MAP_MMHG,
  COLLAPSE_CALIBRATION_EQUIVALENT_DEBT_MIN,
  MYOCARDIAL_CONTRACTILITY_FLOOR,
  CARDIOVASCULAR_COLLAPSE_MAP_MMHG,
  CARDIOVASCULAR_COLLAPSE_MAP_SEC,
  PROFOUND_COLLAPSE_MAP_MMHG,
  PROFOUND_COLLAPSE_MAP_SEC,
  ASPHYXIAL_COLLAPSE_ANCHOR,
  createHumModArdsDecompensationController,
};
