'use strict';

// hummod_ards_core_breathing.js
//
// Source-aligned breathing/gas-conditioning utilities from pinned HumMod.
//
// Sources:
//   Structure/Lungs/Bronchi.DES
//   Structure/Lungs/Breathing.DES
//   Structure/Lungs/GasTools/BTPS_To_STPD.DES
//   Structure/Heat/TempTools.DES
//
// These functions operate in HumMod-native units:
// - volume: mL
// - pressure: mmHg
// - temperature: degrees C / K
// - rate: breaths/min
// - ventilation: mL/min

const HUMMOD_BREATHING_SOURCE = Object.freeze({
  repository: 'riliescu/hummod-standalone',
  revision: '8dab57e05631f779bf5020fe0dd51874d8ae98c1',
  files: Object.freeze([
    'Structure/Lungs/Bronchi.DES',
    'Structure/Lungs/Breathing.DES',
    'Structure/Lungs/GasTools/BTPS_To_STPD.DES',
    'Structure/Heat/TempTools.DES',
  ]),
});

const TEMPTOOLS = Object.freeze({
  A: 18.6686,
  B: 4030.183,
  C: 235.0,
});

const BRONCHI_VAPOR_PRESSURE_MMHG = 47.0;
const BTPS_STPD_P1_MMHG = 760.0;
const BTPS_STPD_T1_K = 273.2;
const HUMMOD_DEAD_SPACE_SLOPE = 0.20;
const HUMMOD_DEAD_SPACE_MIN_ML = 60.0;

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

function fraction(value, label) {
  finite(value, label);
  if (value < 0 || value > 1) throw new Error(label + ' must be in [0,1]');
  return value;
}

function saturationVaporPressureMmHg(tempC) {
  finite(tempC, 'tempC');
  if (tempC > 100) return 760;
  if (tempC < -273.15) return 0;
  return Math.exp(TEMPTOOLS.A - (TEMPTOOLS.B / (tempC + TEMPTOOLS.C)));
}

function bronchiGasFractions({
  inspiredPressureMmHg,
  inspiredO2Fraction,
  inspiredCo2Fraction = 0,
} = {}) {
  positive(inspiredPressureMmHg, 'inspiredPressureMmHg');
  fraction(inspiredO2Fraction, 'inspiredO2Fraction');
  fraction(inspiredCo2Fraction, 'inspiredCo2Fraction');

  const dilution =
    1 - (BRONCHI_VAPOR_PRESSURE_MMHG / inspiredPressureMmHg);

  if (dilution < 0) {
    throw new Error('inspired pressure is below bronchial vapor pressure');
  }

  const o2Fraction = dilution * inspiredO2Fraction;
  const co2Fraction = dilution * inspiredCo2Fraction;

  return Object.freeze({
    dilution,
    waterFraction: BRONCHI_VAPOR_PRESSURE_MMHG / inspiredPressureMmHg,
    o2Fraction,
    co2Fraction,
    po2MmHg: o2Fraction * inspiredPressureMmHg,
    pco2MmHg: co2Fraction * inspiredPressureMmHg,
    source: HUMMOD_BREATHING_SOURCE,
    sourceStructure: 'Bronchi.Calc',
  });
}

function btpsToStpdVolumeMl({
  volumeBtpsMl,
  inspiredPressureMmHg,
  bodyTempC,
} = {}) {
  nonNegative(volumeBtpsMl, 'volumeBtpsMl');
  positive(inspiredPressureMmHg, 'inspiredPressureMmHg');
  finite(bodyTempC, 'bodyTempC');

  const vaporPressureMmHg = saturationVaporPressureMmHg(bodyTempC);
  const p2MmHg = inspiredPressureMmHg - vaporPressureMmHg;
  if (p2MmHg <= 0) {
    throw new Error('BTPS->STPD dry-gas pressure must be > 0');
  }
  const t2K = bodyTempC + 273.15;
  positive(t2K, 'body temperature K');

  return Object.freeze({
    volumeStpdMl:
      volumeBtpsMl *
      (p2MmHg / BTPS_STPD_P1_MMHG) *
      (BTPS_STPD_T1_K / t2K),
    vaporPressureMmHg,
    source: HUMMOD_BREATHING_SOURCE,
    sourceStructure: 'BTPS_To_STPD.Calc',
  });
}

function humModLegacyDeadSpaceMl(tidalVolumeMl) {
  nonNegative(tidalVolumeMl, 'tidalVolumeMl');
  return (HUMMOD_DEAD_SPACE_SLOPE * tidalVolumeMl) +
    HUMMOD_DEAD_SPACE_MIN_ML;
}

function breathingFromVent({
  respiratoryRatePerMin,
  tidalVolumeBtpsMl,
  inspiredPressureMmHg,
  bodyTempC,
  deadSpaceBtpsMl,
  useHumModLegacyDeadSpace = false,
} = {}) {
  positive(respiratoryRatePerMin, 'respiratoryRatePerMin');
  positive(tidalVolumeBtpsMl, 'tidalVolumeBtpsMl');
  positive(inspiredPressureMmHg, 'inspiredPressureMmHg');
  finite(bodyTempC, 'bodyTempC');

  let deadSpaceMl;
  let deadSpaceSource;
  if (deadSpaceBtpsMl != null) {
    nonNegative(deadSpaceBtpsMl, 'deadSpaceBtpsMl');
    deadSpaceMl = deadSpaceBtpsMl;
    deadSpaceSource = 'explicit-boundary';
  } else if (useHumModLegacyDeadSpace) {
    deadSpaceMl = humModLegacyDeadSpaceMl(tidalVolumeBtpsMl);
    deadSpaceSource = 'HumMod-Breathing.DES-legacy-default';
  } else {
    throw new Error(
      'deadSpaceBtpsMl is required unless useHumModLegacyDeadSpace=true');
  }

  if (deadSpaceMl >= tidalVolumeBtpsMl) {
    throw new Error('dead space must be less than tidal volume');
  }

  const tidalStpd = btpsToStpdVolumeMl({
    volumeBtpsMl: tidalVolumeBtpsMl,
    inspiredPressureMmHg,
    bodyTempC,
  });
  const deadStpd = btpsToStpdVolumeMl({
    volumeBtpsMl: deadSpaceMl,
    inspiredPressureMmHg,
    bodyTempC,
  });

  const alveolarVolumeBtpsMl = tidalVolumeBtpsMl - deadSpaceMl;
  const alveolarVolumeStpdMl =
    tidalStpd.volumeStpdMl - deadStpd.volumeStpdMl;

  return Object.freeze({
    respiratoryRatePerMin,
    tidalVolumeBtpsMl,
    deadSpaceBtpsMl: deadSpaceMl,
    deadSpaceSource,
    alveolarVolumeBtpsMl,
    totalVentilationBtpsMlPerMin:
      respiratoryRatePerMin * tidalVolumeBtpsMl,
    alveolarVentilationBtpsMlPerMin:
      respiratoryRatePerMin * alveolarVolumeBtpsMl,
    tidalVolumeStpdMl: tidalStpd.volumeStpdMl,
    deadSpaceStpdMl: deadStpd.volumeStpdMl,
    alveolarVolumeStpdMl,
    totalVentilationStpdMlPerMin:
      respiratoryRatePerMin * tidalStpd.volumeStpdMl,
    alveolarVentilationStpdMlPerMin:
      respiratoryRatePerMin * alveolarVolumeStpdMl,
    source: HUMMOD_BREATHING_SOURCE,
    sourceStructure: 'Breathing.Calc',
  });
}

module.exports = {
  HUMMOD_BREATHING_SOURCE,
  TEMPTOOLS,
  BRONCHI_VAPOR_PRESSURE_MMHG,
  HUMMOD_DEAD_SPACE_SLOPE,
  HUMMOD_DEAD_SPACE_MIN_ML,
  saturationVaporPressureMmHg,
  bronchiGasFractions,
  btpsToStpdVolumeMl,
  humModLegacyDeadSpaceMl,
  breathingFromVent,
};
