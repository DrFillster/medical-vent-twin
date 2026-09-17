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

  if (plateau === null || totalPeep === null || setPeep === null) {
    return Object.freeze({
      plateauPressureCmH2O: plateau,
      totalPeepCmH2O: totalPeep,
      setPeepCmH2O: setPeep,
      airwayOpeningPressureCmH2O: aop,
      intrinsicPeepCmH2O: null,
      effectiveEndExpiratoryReferenceCmH2O: null,
      drivingPressureCmH2O: null,
      status: 'incomplete-hold-measurements',
    });
  }

  const intrinsicPeep = clampNonNegative(totalPeep - setPeep);
  const referenceCandidates = [setPeep, totalPeep];
  if (aop !== null) referenceCandidates.push(aop);
  const effectiveReference = Math.max(...referenceCandidates);
  const drivingPressure = plateau - effectiveReference;

  return Object.freeze({
    plateauPressureCmH2O: plateau,
    totalPeepCmH2O: totalPeep,
    setPeepCmH2O: setPeep,
    airwayOpeningPressureCmH2O: aop,
    intrinsicPeepCmH2O: intrinsicPeep,
    effectiveEndExpiratoryReferenceCmH2O: effectiveReference,
    drivingPressureCmH2O: drivingPressure,
    status: 'derived-from-explicit-zero-flow-holds',
    provenance: Object.freeze({
      plateau: 'Vent inspiratory hold measurement',
      totalPeep: 'Vent expiratory hold measurement',
      setPeep: 'Ventilator setting at expiratory measurement',
      airwayOpeningPressure: aop === null
        ? 'not supplied'
        : 'Vent mechanical phenotype parameter',
      derivation: 'passive respiratory mechanics',
    }),
  });
}

module.exports = { derivePassiveRespiratoryMechanics };
