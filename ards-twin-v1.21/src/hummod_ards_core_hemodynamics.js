'use strict';

// hummod_ards_core_hemodynamics.js
//
// Source-aligned acute hemodynamic primitives extracted from the pinned
// HumMod XML model. Units remain HumMod-native: volume in mL, pressure in
// mmHg, flow in mL/min, heart rate in beats/min.
//
// Source revision:
//   riliescu/hummod-standalone@8dab57e05631f779bf5020fe0dd51874d8ae98c1
//
// Source files:
//   Structure/VascularCompartments/SystemicArtys.DES
//   Structure/VascularCompartments/SystemicVeins.DES
//   Structure/VascularCompartments/RightAtrium.DES
//   Structure/VascularCompartments/PulmArty.DES
//   Structure/VascularCompartments/PulmCapys.DES
//   Structure/VascularCompartments/PulmVeins.DES
//   Structure/VascularCompartments/LeftAtrium.DES
//   Structure/RightHeartPumping/RightHeartPumping-Diastole.DES
//   Structure/RightHeartPumping/RightHeartPumping-Systole.DES
//   Structure/RightHeartPumping/RightHeartPumping-Pumping.DES
//   Structure/LeftHeartPumping/LeftHeartPumping-Diastole.DES
//   Structure/LeftHeartPumping/LeftHeartPumping-Systole.DES
//   Structure/LeftHeartPumping/LeftHeartPumping-Pumping.DES
//
// Phase-1 boundaries:
// - heart rate is supplied explicitly;
// - beta-receptor effects are supplied as contractility multipliers;
// - pericardial transmural pressure is supplied explicitly;
// - Vent/HumMod pressure-unit conversion is NOT performed here;
// - organ-flow/autonomic/endocrine control remains outside this module.

const HUMMOD_HEMODYNAMICS_SOURCE = Object.freeze({
  repository: 'riliescu/hummod-standalone',
  revision: '8dab57e05631f779bf5020fe0dd51874d8ae98c1',
});

const VASCULAR_DEFAULTS = Object.freeze({
  systemicArteries: Object.freeze({
    v0Ml: 850.0,
    complianceMlPerMmHg: 1.55,
    initialVolumeMl: 999.0,
    externalPressureModel: 'zero',
    source: 'SystemicArtys',
  }),
  systemicVeins: Object.freeze({
    v0Ml: 1700.0,
    complianceMlPerMmHg: 88.6,
    initialVolumeModel: 'residual-blood-volume-in-full-HumMod',
    externalPressureModel: 'zero',
    source: 'SystemicVeins',
  }),
  rightAtrium: Object.freeze({
    v0Ml: 0.0,
    complianceMlPerMmHg: 12.5,
    initialVolumeMl: 51.0,
    externalPressureModel: 'pericardial-pressure',
    source: 'RightAtrium',
  }),
  pulmonaryArtery: Object.freeze({
    v0Ml: 110.0,
    complianceMlPerMmHg: 5.3,
    conductanceMlPerMinPerMmHg: 1350.0,
    initialVolumeMl: 201.0,
    externalPressureModel: 'thoracic-average-pressure',
    source: 'PulmArty',
  }),
  pulmonaryCapillaries: Object.freeze({
    v0Ml: 140.0,
    complianceMlPerMmHg: 4.6,
    conductanceMlPerMinPerMmHg: 1800.0,
    initialVolumeMl: 200.0,
    externalPressureModel: 'thoracic-average-pressure',
    source: 'PulmCapys',
  }),
  pulmonaryVeins: Object.freeze({
    v0Ml: 150.0,
    complianceMlPerMmHg: 6.0,
    conductanceMlPerMinPerMmHg: 5400.0,
    initialVolumeMl: 211.0,
    externalPressureModel: 'thoracic-average-pressure',
    source: 'PulmVeins',
  }),
  leftAtrium: Object.freeze({
    v0Ml: 0.0,
    complianceMlPerMmHg: 6.25,
    initialVolumeMl: 51.0,
    externalPressureModel: 'pericardial-pressure',
    source: 'LeftAtrium',
  }),
});

const PUMP_DEFAULTS = Object.freeze({
  right: Object.freeze({
    diastolicABasic: 0.00026,
    diastolicN: 2.0,
    systolicABasic: 3.53,
    systolicN: 0.5,
    endSystolicPressureOffsetMmHg: 9.0,
    sourcePrefix: 'RightHeartPumping',
  }),
  left: Object.freeze({
    diastolicABasic: 0.00051,
    diastolicN: 2.0,
    systolicABasic: 17.39,
    systolicN: 0.5,
    endSystolicPressureOffsetMmHg: 24.0,
    sourcePrefix: 'LeftHeartPumping',
  }),
});

function finite(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(label + ' must be a finite number');
  }
  return value;
}

function positive(value, label) {
  finite(value, label);
  if (!(value > 0)) throw new Error(label + ' must be > 0');
  return value;
}

function nonNegative(value, label) {
  finite(value, label);
  if (value < 0) throw new Error(label + ' must be >= 0');
  return value;
}

function stressedVolumePressure({
  volumeMl,
  v0Ml,
  complianceMlPerMmHg,
  externalPressureMmHg = 0,
  clampStressedVolumeAtZero = true,
} = {}) {
  finite(volumeMl, 'volumeMl');
  finite(v0Ml, 'v0Ml');
  positive(complianceMlPerMmHg, 'complianceMlPerMmHg');
  finite(externalPressureMmHg, 'externalPressureMmHg');

  const rawStressedVolumeMl = volumeMl - v0Ml;
  const stressedVolumeMl = clampStressedVolumeAtZero
    ? Math.max(rawStressedVolumeMl, 0)
    : rawStressedVolumeMl;

  return Object.freeze({
    stressedVolumeMl,
    pressureMmHg:
      (stressedVolumeMl / complianceMlPerMmHg) + externalPressureMmHg,
  });
}

function conductanceFlow({
  conductanceMlPerMinPerMmHg,
  upstreamPressureMmHg,
  downstreamPressureMmHg,
} = {}) {
  nonNegative(conductanceMlPerMinPerMmHg, 'conductanceMlPerMinPerMmHg');
  finite(upstreamPressureMmHg, 'upstreamPressureMmHg');
  finite(downstreamPressureMmHg, 'downstreamPressureMmHg');
  return conductanceMlPerMinPerMmHg *
    (upstreamPressureMmHg - downstreamPressureMmHg);
}

function pericardialPressure({
  thoracicPressureMmHg,
  pericardialTmpMmHg = 0,
} = {}) {
  finite(thoracicPressureMmHg, 'thoracicPressureMmHg');
  finite(pericardialTmpMmHg, 'pericardialTmpMmHg');
  return thoracicPressureMmHg + pericardialTmpMmHg;
}

function ventricularPump({
  side,
  atrialPressureMmHg,
  arterialPressureMmHg,
  pericardialPressureMmHg,
  heartRatePerMin,
  contractilityMultiplier = 1,
  stiffnessMultiplier = 1,
} = {}) {
  if (side !== 'right' && side !== 'left') {
    throw new Error('side must be right or left');
  }
  finite(atrialPressureMmHg, 'atrialPressureMmHg');
  finite(arterialPressureMmHg, 'arterialPressureMmHg');
  finite(pericardialPressureMmHg, 'pericardialPressureMmHg');
  positive(heartRatePerMin, 'heartRatePerMin');
  positive(contractilityMultiplier, 'contractilityMultiplier');
  positive(stiffnessMultiplier, 'stiffnessMultiplier');

  const p = PUMP_DEFAULTS[side];

  const edpMmHg = atrialPressureMmHg;
  const diastolicTmpMmHg = edpMmHg - pericardialPressureMmHg;
  if (diastolicTmpMmHg < 0) {
    throw new Error(
      side + ' ventricular diastolic transmural pressure is negative; ' +
      'source equation is undefined for fractional power');
  }

  const diastolicA = stiffnessMultiplier * p.diastolicABasic;
  const edvMl = Math.pow(
    diastolicTmpMmHg / diastolicA,
    1 / p.diastolicN
  );

  const espMmHg = arterialPressureMmHg + p.endSystolicPressureOffsetMmHg;
  const systolicTmpMmHg = espMmHg - pericardialPressureMmHg;
  if (systolicTmpMmHg < 0) {
    throw new Error(
      side + ' ventricular systolic transmural pressure is negative; ' +
      'source equation is undefined for fractional power');
  }

  const systolicA = contractilityMultiplier * p.systolicABasic;
  const esvMl = Math.pow(
    systolicTmpMmHg / systolicA,
    1 / p.systolicN
  );

  const strokeVolumeMl = edvMl - esvMl;
  const bloodFlowMlPerMin = heartRatePerMin * strokeVolumeMl;
  const ejectionFraction = edvMl > 0 ? strokeVolumeMl / edvMl : null;

  return Object.freeze({
    side,
    edpMmHg,
    edvMl,
    espMmHg,
    esvMl,
    strokeVolumeMl,
    bloodFlowMlPerMin,
    ejectionFraction,
    contractilityMultiplier,
    stiffnessMultiplier,
    source: HUMMOD_HEMODYNAMICS_SOURCE,
    sourceStructures: Object.freeze([
      p.sourcePrefix + '-Diastole',
      p.sourcePrefix + '-Systole',
      p.sourcePrefix + '-Pumping',
    ]),
  });
}

module.exports = {
  HUMMOD_HEMODYNAMICS_SOURCE,
  VASCULAR_DEFAULTS,
  PUMP_DEFAULTS,
  stressedVolumePressure,
  conductanceFlow,
  pericardialPressure,
  ventricularPump,
};
