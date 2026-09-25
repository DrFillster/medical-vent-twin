'use strict';

// bedside_measurements.js
//
// Pure derivation layer for passive ventilator measurements. The Simulation
// engine owns the actual inspiratory/expiratory occlusion maneuvers; this
// module converts completed maneuver measurements into clinically named
// respiratory-mechanics values.
//
// Clinical basis:
// - Plateau pressure is obtained from a zero-flow end-inspiratory hold.
// - Total PEEP is obtained from a zero-flow end-expiratory hold.
// - Intrinsic PEEP is the pressure above set PEEP revealed by the expiratory
//   hold.
// - In a model that explicitly includes airway-opening pressure (AOP), the
//   end-expiratory reference for airway driving pressure must not be lower
//   than a measured total PEEP or AOP. This prevents falsely low driving
//   pressure when set PEEP is below a closed-airway threshold.
//
// This is an engineering derivation for the educational/research simulator,
// not a bedside treatment recommendation.

function finiteOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function clampNonNegative(value) {
  if (value === null) return null;
  return value < 0 ? 0 : value;
}

function derivePassiveRespiratoryMechanics({
  plateauPressureCmH2O,
  totalPeepCmH2O,
  setPeepCmH2O,
  airwayOpeningPressureCmH2O = null,
} = {}) {
  const plateau = finiteOrNull(plateauPressureCmH2O);
  const totalPeep = finiteOrNull(totalPeepCmH2O);
  const setPeep = finiteOrNull(setPeepCmH2O);
  const aop = finiteOrNull(airwayOpeningPressureCmH2O);

  // Intrinsic PEEP can be derived whenever an expiratory hold has supplied
  // total PEEP together with the set PEEP at the time of the hold. Plateau
  // is not required for this single value (driving pressure still is).
  const hasExpiratoryHold = totalPeep !== null && setPeep !== null;
  const intrinsicPeep = hasExpiratoryHold
    ? clampNonNegative(totalPeep - setPeep)
    : null;

  // Driving pressure requires BOTH a plateau (inspiratory hold) AND an
  // end-expiratory reference. Without a measured total PEEP the only
  // reference available is set PEEP, which is what the user dialed in
  // rather than what the lung actually achieved — refuse to derive rather
  // than fabricate a value. When an expiratory hold is also present, use
  // the more conservative end-expiratory reference (max of set PEEP,
  // measured total PEEP, modeled airway opening pressure) so a closed-
  // airway threshold doesn't bias the value downward.
  let effectiveReference = null;
  let drivingPressure = null;
  if (plateau !== null && hasExpiratoryHold) {
    const referenceCandidates = [setPeep, totalPeep];
    if (aop !== null) referenceCandidates.push(aop);
    effectiveReference = Math.max(...referenceCandidates);
    drivingPressure = plateau - effectiveReference;
  }

  const status = (plateau !== null && hasExpiratoryHold)
    ? 'derived-from-explicit-zero-flow-holds'
    : (hasExpiratoryHold ? 'expiratory-hold-only' : 'incomplete-hold-measurements');

  const result = {
    plateauPressureCmH2O: plateau,
    totalPeepCmH2O: totalPeep,
    setPeepCmH2O: setPeep,
    airwayOpeningPressureCmH2O: aop,
    intrinsicPeepCmH2O: intrinsicPeep,
    effectiveEndExpiratoryReferenceCmH2O: effectiveReference,
    drivingPressureCmH2O: drivingPressure,
    status,
  };
  if (status === 'derived-from-explicit-zero-flow-holds') {
    result.provenance = Object.freeze({
      plateau: 'Vent inspiratory hold measurement',
      totalPeep: 'Vent expiratory hold measurement',
      setPeep: 'Ventilator setting at expiratory measurement',
      airwayOpeningPressure: aop === null
        ? 'not supplied'
        : 'Vent mechanical phenotype parameter',
      derivation: 'passive respiratory mechanics',
    });
  }
  return Object.freeze(result);
}

function latestMeasurement(measurements, kind) {
  if (!Array.isArray(measurements)) return null;
  for (let i = measurements.length - 1; i >= 0; i--) {
    if (measurements[i] && measurements[i].kind === kind) return measurements[i];
  }
  return null;
}

function summarizeSimulationMeasurements(simulation) {
  if (!simulation || typeof simulation !== 'object') {
    throw new Error('simulation object is required');
  }

  const inspiratory = latestMeasurement(simulation.measurements, 'INSPIRATORY_HOLD');
  const expiratory = latestMeasurement(simulation.measurements, 'EXPIRATORY_HOLD');
  const aop = simulation.params
    ? finiteOrNull(simulation.params.airwayOpeningPressure)
    : null;

  const derived = derivePassiveRespiratoryMechanics({
    plateauPressureCmH2O: inspiratory ? inspiratory.plateauPressureCmH2O : null,
    totalPeepCmH2O: expiratory ? expiratory.totalPeepCmH2O : null,
    setPeepCmH2O: expiratory ? expiratory.setPeepCmH2O : null,
    airwayOpeningPressureCmH2O: aop,
  });

  return Object.freeze({
    ...derived,
    inspiratoryHold: inspiratory,
    expiratoryHold: expiratory,
  });
}

module.exports = {
  derivePassiveRespiratoryMechanics,
  summarizeSimulationMeasurements,
};
