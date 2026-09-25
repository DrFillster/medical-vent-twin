'use strict';

// hummod_ards_core_chemistry.js
//
// Source-aligned acute blood-gas chemistry extracted from the pinned HumMod
// standalone XML model. This module intentionally implements only compact,
// separable equations whose dependencies are explicit.
//
// Source revision:
//   riliescu/hummod-standalone@8dab57e05631f779bf5020fe0dd51874d8ae98c1
//
// Source files:
//   Structure/AcidBase/PhGeneral.DES
//   Structure/CO2/Blood-BaseToGas.DES
//   Structure/Hemoglobin/HgbProps.DES
//
// Not yet included here:
// - total blood O2 content (requires Hgb/Hct/CO state)
// - tissue O2 extraction / mixed venous O2
// - CO2 mass transport
// - renal/metabolic acid-base regulation

const HUMMOD_CHEMISTRY_SOURCE = Object.freeze({
  repository: 'riliescu/hummod-standalone',
  revision: '8dab57e05631f779bf5020fe0dd51874d8ae98c1',
  files: Object.freeze([
    'Structure/AcidBase/PhGeneral.DES',
    'Structure/CO2/Blood-BaseToGas.DES',
    'Structure/Hemoglobin/HgbProps.DES',
  ]),
});

const PH_GENERAL_PK_BLOOD = 7.42;
const BASE_TO_GAS_C = -645.8;
const BASE_TO_GAS_D = 2777.8;

const HGB = Object.freeze({
  hillConstant: 2.3,
  po2SaturatedMmHg: 120,
  tempK: 0.024,
  phK: -0.40,
  pco2K: 0.06,
  coK: -0.0067,
  tempNormC: 37.0,
  phNorm: 7.40,
  co2NormMmHg: 40.0,
  coNormPercent: 0.0,
  p50BasicMmHg: 26.6,
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

function phFromPco2Sid({
  pco2MmHg,
  sid,
  pK = PH_GENERAL_PK_BLOOD,
} = {}) {
  finite(pco2MmHg, 'pco2MmHg');
  finite(sid, 'sid');
  finite(pK, 'pK');

  let pH;
  if (pco2MmHg <= 0) {
    pH = pK + 3;
  } else if ((sid / pco2MmHg) < 1e-3) {
    pH = pK - 3;
  } else {
    pH = pK + Math.log10(sid / pco2MmHg);
  }

  return Object.freeze({
    pH,
    hydrogenIon: Math.pow(10, 9 - pH),
    source: HUMMOD_CHEMISTRY_SOURCE,
    sourceStructure: 'PhGeneral.Calc',
  });
}

function pco2FromHco3Sid({
  hco3MolPerL,
  sidMolPerL,
} = {}) {
  finite(hco3MolPerL, 'hco3MolPerL');
  finite(sidMolPerL, 'sidMolPerL');

  const pco2MmHg = (hco3MolPerL > 0 && sidMolPerL > 0)
    ? Math.max(
      (BASE_TO_GAS_C * sidMolPerL) + (BASE_TO_GAS_D * hco3MolPerL),
      0.0001
    )
    : 0.0001;

  return Object.freeze({
    pco2MmHg,
    source: HUMMOD_CHEMISTRY_SOURCE,
    sourceStructure: 'Blood-BaseToGas.Calc',
  });
}

function hemoglobinProperties({
  tempC,
  pH,
  pco2MmHg,
  carboxyPercent = 0,
  tempSensitivity = 1,
  phSensitivity = 1,
  pco2Sensitivity = 1,
  coSensitivity = 1,
} = {}) {
  finite(tempC, 'tempC');
  finite(pH, 'pH');
  positive(pco2MmHg, 'pco2MmHg');
  finite(carboxyPercent, 'carboxyPercent');
  finite(tempSensitivity, 'tempSensitivity');
  finite(phSensitivity, 'phSensitivity');
  finite(pco2Sensitivity, 'pco2Sensitivity');
  finite(coSensitivity, 'coSensitivity');

  const tempEffect = Math.pow(
    10,
    tempSensitivity * HGB.tempK * (tempC - HGB.tempNormC)
  );

  const phEffect = Math.pow(
    10,
    phSensitivity * HGB.phK * (pH - HGB.phNorm)
  );

  const logPco2 = pco2MmHg < 1 ? 0 : Math.log10(pco2MmHg);
  const pco2Effect = Math.pow(
    10,
    pco2Sensitivity * HGB.pco2K *
      (logPco2 - Math.log10(HGB.co2NormMmHg))
  );

  const coEffect = Math.pow(
    10,
    coSensitivity * HGB.coK * (carboxyPercent - HGB.coNormPercent)
  );

  const p50MmHg =
    HGB.p50BasicMmHg *
    tempEffect *
    phEffect *
    pco2Effect *
    coEffect;

  const an = Math.pow(HGB.po2SaturatedMmHg / p50MmHg, HGB.hillConstant);
  const scaleForSat = (1 + an) / an;

  return Object.freeze({
    p50MmHg,
    scaleForSat,
    effects: Object.freeze({
      temperature: tempEffect,
      pH: phEffect,
      pco2: pco2Effect,
      carbonMonoxide: coEffect,
    }),
    source: HUMMOD_CHEMISTRY_SOURCE,
    sourceStructure: 'HgbProps.Setup',
  });
}

function saturationFractionFromPo2({
  po2MmHg,
  p50MmHg,
  scaleForSat,
} = {}) {
  finite(po2MmHg, 'po2MmHg');
  positive(p50MmHg, 'p50MmHg');
  positive(scaleForSat, 'scaleForSat');

  if (po2MmHg <= 0) return 0;

  if (po2MmHg >= HGB.po2SaturatedMmHg) {
    // HumMod's PO2ToO2 path adds dissolved oxygen above this point. Without
    // importing HgbConc.[O2Max], the reduced core reports saturation only and
    // caps it at 1 rather than inventing total oxygen content.
    return 1;
  }

  const an = Math.pow(po2MmHg / p50MmHg, HGB.hillConstant);
  const sat = scaleForSat * an / (1 + an);
  return Math.max(0, Math.min(1, sat));
}

function saturationPercentFromPo2(args) {
  return 100 * saturationFractionFromPo2(args);
}

module.exports = {
  HUMMOD_CHEMISTRY_SOURCE,
  PH_GENERAL_PK_BLOOD,
  BASE_TO_GAS_C,
  BASE_TO_GAS_D,
  HGB,
  phFromPco2Sid,
  pco2FromHco3Sid,
  hemoglobinProperties,
  saturationFractionFromPo2,
  saturationPercentFromPo2,
};
