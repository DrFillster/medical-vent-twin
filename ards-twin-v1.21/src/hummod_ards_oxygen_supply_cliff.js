'use strict';

// Oxygen delivery / demand "cliff" for the reduced ARDS browser core.
//
// The governing physiology is the biphasic DO2-VO2 relationship:
// above a critical oxygen delivery (DO2crit), VO2 is demand determined;
// below DO2crit, VO2 becomes supply dependent.
//
// Hypercapnia modifies the extraction reserve. Ward (Anesthesiology 1996)
// reported in mechanically ventilated dogs:
//   normocapnia: DO2crit 7.8 +/- 1.5 mL/kg/min, critical extraction 0.72 +/- 0.04
//   moderate HCA (PaCO2 72 +/- 3): no significant change
//   severe HCA (PaCO2 118 +/- 4): DO2crit 12.5 +/- 1.8,
//                                  critical extraction 0.54 +/- 0.035
//
// The reduced model therefore preserves normal extraction through the
// moderate-hypercapnia anchor and linearly interpolates the documented loss
// of extraction reserve from PaCO2 72 to 118 mmHg. It is bounded beyond the
// severe anchor; no unsupported extrapolation is used.
//
// This module is an evidence-anchored reduced-order relation, not a verbatim
// HumMod equation and not a validated clinical decision rule.

const OXYGEN_SUPPLY_CLIFF_ANCHOR = Object.freeze({
  normocapnicCriticalExtractionRatio: 0.72,
  moderateHypercapniaPaco2MmHg: 72,
  severeHypercapniaPaco2MmHg: 118,
  severeHypercapniaCriticalExtractionRatio: 0.54,
  citation:
    'Ward ME. Anesthesiology. 1996;85:817-822. doi:10.1097/00000542-199610000-00017',
});

function finite(v, label) {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error(label + ' must be finite');
  }
  return v;
}
function positive(v, label) {
  finite(v, label);
  if (!(v > 0)) throw new Error(label + ' must be > 0');
  return v;
}
function nonNegative(v, label) {
  finite(v, label);
  if (v < 0) throw new Error(label + ' must be >= 0');
  return v;
}
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function criticalExtractionRatioForPaco2(paco2MmHg) {
  nonNegative(paco2MmHg, 'paco2MmHg');
  const a = OXYGEN_SUPPLY_CLIFF_ANCHOR;
  if (paco2MmHg <= a.moderateHypercapniaPaco2MmHg) {
    return a.normocapnicCriticalExtractionRatio;
  }
  if (paco2MmHg >= a.severeHypercapniaPaco2MmHg) {
    return a.severeHypercapniaCriticalExtractionRatio;
  }
  const t = (paco2MmHg - a.moderateHypercapniaPaco2MmHg) /
    (a.severeHypercapniaPaco2MmHg - a.moderateHypercapniaPaco2MmHg);
  return a.normocapnicCriticalExtractionRatio +
    t * (a.severeHypercapniaCriticalExtractionRatio -
      a.normocapnicCriticalExtractionRatio);
}

function evaluateOxygenSupplyCliff({
  cardiacOutputMlPerMin,
  arterialO2ContentMlPerMl,
  requestedTissueO2UseMlPerMin,
  arterialPco2MmHg,
  physicalMaxAerobicO2UseMlPerMin,
} = {}) {
  positive(cardiacOutputMlPerMin, 'cardiacOutputMlPerMin');
  nonNegative(arterialO2ContentMlPerMl, 'arterialO2ContentMlPerMl');
  nonNegative(requestedTissueO2UseMlPerMin,
    'requestedTissueO2UseMlPerMin');
  nonNegative(arterialPco2MmHg, 'arterialPco2MmHg');
  nonNegative(physicalMaxAerobicO2UseMlPerMin,
    'physicalMaxAerobicO2UseMlPerMin');

  const oxygenDeliveryMlPerMin =
    cardiacOutputMlPerMin * arterialO2ContentMlPerMl;
  const criticalExtractionRatio =
    criticalExtractionRatioForPaco2(arterialPco2MmHg);

  const criticalOxygenDeliveryMlPerMin =
    requestedTissueO2UseMlPerMin > 0
      ? requestedTissueO2UseMlPerMin / criticalExtractionRatio
      : 0;

  const extractionLimitedMaxAerobicO2UseMlPerMin =
    oxygenDeliveryMlPerMin * criticalExtractionRatio;

  const maxAerobicO2UseMlPerMin = Math.min(
    physicalMaxAerobicO2UseMlPerMin,
    extractionLimitedMaxAerobicO2UseMlPerMin);

  const actualTissueO2UseMlPerMin = Math.min(
    requestedTissueO2UseMlPerMin,
    maxAerobicO2UseMlPerMin);

  const oxygenSupplyDeficitMlPerMin = Math.max(
    0,
    requestedTissueO2UseMlPerMin - actualTissueO2UseMlPerMin);

  const deliveryToCriticalRatio = criticalOxygenDeliveryMlPerMin > 0
    ? oxygenDeliveryMlPerMin / criticalOxygenDeliveryMlPerMin
    : Infinity;

  const deliveryToDemandRatio = requestedTissueO2UseMlPerMin > 0
    ? oxygenDeliveryMlPerMin / requestedTissueO2UseMlPerMin
    : Infinity;

  const actualExtractionRatio = oxygenDeliveryMlPerMin > 0
    ? actualTissueO2UseMlPerMin / oxygenDeliveryMlPerMin
    : 0;

  return Object.freeze({
    oxygenDeliveryMlPerMin,
    requestedTissueO2UseMlPerMin,
    actualTissueO2UseMlPerMin,
    oxygenSupplyDeficitMlPerMin,
    criticalExtractionRatio,
    actualExtractionRatio,
    criticalOxygenDeliveryMlPerMin,
    deliveryToCriticalRatio,
    deliveryToDemandRatio,
    extractionLimitedMaxAerobicO2UseMlPerMin,
    physicalMaxAerobicO2UseMlPerMin,
    maxAerobicO2UseMlPerMin,
    supplyDependent:
      oxygenSupplyDeficitMlPerMin > Math.max(1e-9,
        requestedTissueO2UseMlPerMin * 1e-9),
    reserveFraction: clamp(deliveryToCriticalRatio - 1, 0, 1),
    provenance: OXYGEN_SUPPLY_CLIFF_ANCHOR,
  });
}

module.exports = {
  OXYGEN_SUPPLY_CLIFF_ANCHOR,
  criticalExtractionRatioForPaco2,
  evaluateOxygenSupplyCliff,
};
