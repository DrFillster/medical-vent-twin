'use strict';

// hummod_ards_core_thorax.js
//
// Reduced chest-wall / pleural-pressure bridge for the live ARDS core.
//
// This module does not infer chest-wall mechanics from Berlin severity,
// recruitability, BMI, or airway pressure alone. Absolute pleural pressure
// requires an explicit authored/measured baseline. Dynamic changes use the
// passive static elastance partition:
//
//   dPpl = dPaw * Ecw / Ers
//   dPL  = dPaw * EL  / Ers
//
// with Ers = EL + Ecw.
//
// This is suitable as a phase-1 quasi-static coupling layer for passive
// ventilation. It is not a substitute for measured esophageal pressure,
// regional pleural-pressure gradients, spontaneous effort, or nonlinear
// chest-wall mechanics.

function finite(v, label) {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error(label + ' must be a finite number');
  }
  return v;
}

function fraction(v, label) {
  finite(v, label);
  if (v < 0 || v > 1) throw new Error(label + ' must be in [0,1]');
  return v;
}

function createThoraxState({
  referenceAirwayPressureCmH2O,
  referencePleuralPressureCmH2O,
  chestWallElastanceFraction,
  provenance,
} = {}) {
  finite(referenceAirwayPressureCmH2O, 'referenceAirwayPressureCmH2O');
  finite(referencePleuralPressureCmH2O, 'referencePleuralPressureCmH2O');
  fraction(chestWallElastanceFraction, 'chestWallElastanceFraction');

  if (!provenance || typeof provenance !== 'object') {
    throw new Error('thorax provenance is required');
  }

  const lungElastanceFraction = 1 - chestWallElastanceFraction;

  function atStaticAirwayPressure(airwayPressureCmH2O) {
    finite(airwayPressureCmH2O, 'airwayPressureCmH2O');
    const deltaAirwayCmH2O =
      airwayPressureCmH2O - referenceAirwayPressureCmH2O;
    const deltaPleuralCmH2O =
      deltaAirwayCmH2O * chestWallElastanceFraction;
    const pleuralPressureCmH2O =
      referencePleuralPressureCmH2O + deltaPleuralCmH2O;
    const transpulmonaryPressureCmH2O =
      airwayPressureCmH2O - pleuralPressureCmH2O;

    return Object.freeze({
      airwayPressureCmH2O,
      pleuralPressureCmH2O,
      transpulmonaryPressureCmH2O,
      deltaAirwayCmH2O,
      deltaPleuralCmH2O,
      deltaTranspulmonaryCmH2O:
        deltaAirwayCmH2O * lungElastanceFraction,
      chestWallElastanceFraction,
      lungElastanceFraction,
      interpretation: 'passive-static-linear-elastance-partition',
      provenance: Object.freeze({ ...provenance }),
    });
  }

  return Object.freeze({
    schema: 'hummod-ards-thorax/v1',
    referenceAirwayPressureCmH2O,
    referencePleuralPressureCmH2O,
    chestWallElastanceFraction,
    lungElastanceFraction,
    provenance: Object.freeze({ ...provenance }),
    atStaticAirwayPressure,
  });
}

module.exports = {
  createThoraxState,
};
