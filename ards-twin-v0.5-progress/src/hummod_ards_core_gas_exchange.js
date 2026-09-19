'use strict';

// hummod_ards_core_gas_exchange.js
//
// Reduced acute pulmonary gas-exchange equations aligned to the pinned HumMod
// source. This module preserves HumMod's algebraic/implicit structure while
// requiring explicit boundary inputs for quantities that the full HumMod model
// normally supplies through other systems.
//
// Source revision:
//   riliescu/hummod-standalone@8dab57e05631f779bf5020fe0dd51874d8ae98c1
//
// Source files:
//   Structure/Lungs/LungO2.DES
//   Structure/Lungs/LungCO2.DES
//   Structure/Lungs/LungVeinO2.DES
//   Structure/Lungs/LungVeinCO2.DES
//   Structure/CO2/Blood-GasToBase.DES
//   Structure/CO2/CO2Tools.DES
//   Structure/Hemoglobin/HgbProps.DES
//
// IMPORTANT:
// - This is not yet clinical validation.
// - Vent -> STPD alveolar ventilation conversion is an unresolved adapter.
// - Pulmonary membrane permeability is an explicit boundary in v0.
// - Mixed venous O2/HCO3 and metabolic demand are explicit boundaries in v0.
// - Solver tolerances are engineering choices for this JS implementation and
//   are not copied from HumMod's C++ implicit-equation solver.

const {
  HGB,
  hemoglobinProperties,
} = require('./hummod_ards_core_chemistry.js');

const HUMMOD_GAS_EXCHANGE_SOURCE = Object.freeze({
  repository: 'riliescu/hummod-standalone',
  revision: '8dab57e05631f779bf5020fe0dd51874d8ae98c1',
  files: Object.freeze([
    'Structure/Lungs/LungO2.DES',
    'Structure/Lungs/LungCO2.DES',
    'Structure/Lungs/LungVeinO2.DES',
    'Structure/Lungs/LungVeinCO2.DES',
    'Structure/CO2/Blood-GasToBase.DES',
    'Structure/CO2/CO2Tools.DES',
    'Structure/Hemoglobin/HgbProps.DES',
  ]),
});

const BLOOD_GAS_TO_BASE_A = 0.2325;
const BLOOD_GAS_TO_BASE_B = 0.00036;
const CO2_MOLS_TO_LITERS = 22.4;
const CO2_LITERS_TO_MOLS = 0.0446;
const O2_SOLUBILITY = 0.00003;

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

function hco3FromPco2Sid({
  pco2MmHg,
  sidMolPerL,
} = {}) {
  finite(pco2MmHg, 'pco2MmHg');
  finite(sidMolPerL, 'sidMolPerL');

  const hco3MolPerL = (pco2MmHg > 0 && sidMolPerL > 0)
    ? (BLOOD_GAS_TO_BASE_A * sidMolPerL) +
      (BLOOD_GAS_TO_BASE_B * pco2MmHg)
    : 0.0001;

  return Object.freeze({
    hco3MolPerL,
    sourceStructure: 'Blood-GasToBase.Calc',
    source: HUMMOD_GAS_EXCHANGE_SOURCE,
  });
}

function o2ContentFromPo2({
  po2MmHg,
  o2MaxMlPerMl,
  p50MmHg,
  scaleForSat,
} = {}) {
  finite(po2MmHg, 'po2MmHg');
  positive(o2MaxMlPerMl, 'o2MaxMlPerMl');
  positive(p50MmHg, 'p50MmHg');
  positive(scaleForSat, 'scaleForSat');

  if (po2MmHg <= 0) return 0;

  if (po2MmHg >= HGB.po2SaturatedMmHg) {
    return o2MaxMlPerMl +
      ((po2MmHg - HGB.po2SaturatedMmHg) * O2_SOLUBILITY);
  }

  const an = Math.pow(po2MmHg / p50MmHg, HGB.hillConstant);
  const sat = scaleForSat * an / (1 + an);
  return sat * o2MaxMlPerMl;
}

function po2FromO2Content({
  o2ContentMlPerMl,
  o2MaxMlPerMl,
  p50MmHg,
  scaleForSat,
} = {}) {
  nonNegative(o2ContentMlPerMl, 'o2ContentMlPerMl');
  positive(o2MaxMlPerMl, 'o2MaxMlPerMl');
  positive(p50MmHg, 'p50MmHg');
  positive(scaleForSat, 'scaleForSat');

  if (o2ContentMlPerMl <= 0) return 0;

  if (o2ContentMlPerMl > o2MaxMlPerMl) {
    return HGB.po2SaturatedMmHg +
      ((o2ContentMlPerMl - o2MaxMlPerMl) / O2_SOLUBILITY);
  }

  const sat = o2ContentMlPerMl / o2MaxMlPerMl;
  const s = sat / scaleForSat;
  if (s <= 0) return 0;
  if (s >= 1) return HGB.po2SaturatedMmHg;

  const a = Math.pow(s / (1 - s), 1 / HGB.hillConstant);
  return a * p50MmHg;
}

function solveRootBisection({
  fn,
  low,
  high,
  tolerance,
  maxIterations = 200,
  label = 'implicit equation',
} = {}) {
  positive(tolerance, 'tolerance');
  positive(maxIterations, 'maxIterations');
  let lo = finite(low, 'low');
  let hi = finite(high, 'high');
  if (!(hi > lo)) throw new Error('high must be > low');

  let flo = finite(fn(lo), label + ' f(low)');
  let fhi = finite(fn(hi), label + ' f(high)');
  if (flo === 0) return lo;
  if (fhi === 0) return hi;
  if (flo * fhi > 0) {
    throw new Error(label + ' root is not bracketed');
  }

  for (let i = 0; i < maxIterations; i += 1) {
    const mid = (lo + hi) / 2;
    const fm = finite(fn(mid), label + ' f(mid)');
    if (Math.abs(fm) <= tolerance || Math.abs(hi - lo) <= tolerance) {
      return mid;
    }
    if (flo * fm <= 0) {
      hi = mid;
      fhi = fm;
    } else {
      lo = mid;
      flo = fm;
    }
  }
  throw new Error(label + ' did not converge');
}

function solveOxygenExchange({
  alveolarVentilationStpdMlPerMin,
  bronchiO2Fraction,
  barometricPressureMmHg,
  pulmonaryMembranePermeabilityMlPerMinPerMmHg,
  ventilatedPulmonaryBloodFlowMlPerMin,
  mixedVenousO2ContentMlPerMl,
  o2MaxMlPerMl,
  tempC,
  arterialPhEstimate,
  arterialPco2EstimateMmHg,
  carboxyPercent = 0,
} = {}) {
  positive(alveolarVentilationStpdMlPerMin, 'alveolarVentilationStpdMlPerMin');
  fraction(bronchiO2Fraction, 'bronchiO2Fraction');
  positive(barometricPressureMmHg, 'barometricPressureMmHg');
  positive(
    pulmonaryMembranePermeabilityMlPerMinPerMmHg,
    'pulmonaryMembranePermeabilityMlPerMinPerMmHg'
  );
  nonNegative(ventilatedPulmonaryBloodFlowMlPerMin, 'ventilatedPulmonaryBloodFlowMlPerMin');
  nonNegative(mixedVenousO2ContentMlPerMl, 'mixedVenousO2ContentMlPerMl');
  positive(o2MaxMlPerMl, 'o2MaxMlPerMl');

  const props = hemoglobinProperties({
    tempC,
    pH: arterialPhEstimate,
    pco2MmHg: arterialPco2EstimateMmHg,
    carboxyPercent,
  });

  if (ventilatedPulmonaryBloodFlowMlPerMin === 0) {
    const pAlveolarMmHg = bronchiO2Fraction * barometricPressureMmHg;
    return Object.freeze({
      uptakeMlPerMin: 0,
      alveolarO2Fraction: bronchiO2Fraction,
      pAlveolarO2MmHg: pAlveolarMmHg,
      pCapillaryO2MmHg: pAlveolarMmHg,
      capillaryO2ContentMlPerMl: mixedVenousO2ContentMlPerMl,
      hemoglobinProperties: props,
      source: HUMMOD_GAS_EXCHANGE_SOURCE,
    });
  }

  function residual(uptakeMlPerMin) {
    const alveolarO2Fraction =
      bronchiO2Fraction -
      (uptakeMlPerMin / alveolarVentilationStpdMlPerMin);
    const pAlveolarO2MmHg =
      alveolarO2Fraction * barometricPressureMmHg;
    const membraneGradientMmHg =
      uptakeMlPerMin / pulmonaryMembranePermeabilityMlPerMinPerMmHg;
    const pCapillaryO2MmHg =
      pAlveolarO2MmHg - membraneGradientMmHg;
    const capillaryO2ContentMlPerMl = o2ContentFromPo2({
      po2MmHg: pCapillaryO2MmHg,
      o2MaxMlPerMl,
      p50MmHg: props.p50MmHg,
      scaleForSat: props.scaleForSat,
    });
    const endUptakeMlPerMin =
      ventilatedPulmonaryBloodFlowMlPerMin *
      (capillaryO2ContentMlPerMl - mixedVenousO2ContentMlPerMl);
    return endUptakeMlPerMin - uptakeMlPerMin;
  }

  const upperByVentilation =
    bronchiO2Fraction * alveolarVentilationStpdMlPerMin;
  const upper = Math.max(1e-9, upperByVentilation * 0.999999);

  const uptakeMlPerMin = solveRootBisection({
    fn: residual,
    low: 0,
    high: upper,
    tolerance: 1e-6,
    label: 'HumMod LungO2 uptake',
  });

  const alveolarO2Fraction =
    bronchiO2Fraction -
    (uptakeMlPerMin / alveolarVentilationStpdMlPerMin);
  const pAlveolarO2MmHg =
    alveolarO2Fraction * barometricPressureMmHg;
  const membraneGradientMmHg =
    uptakeMlPerMin / pulmonaryMembranePermeabilityMlPerMinPerMmHg;
  const pCapillaryO2MmHg =
    pAlveolarO2MmHg - membraneGradientMmHg;
  const capillaryO2ContentMlPerMl = o2ContentFromPo2({
    po2MmHg: pCapillaryO2MmHg,
    o2MaxMlPerMl,
    p50MmHg: props.p50MmHg,
    scaleForSat: props.scaleForSat,
  });

  return Object.freeze({
    uptakeMlPerMin,
    alveolarO2Fraction,
    pAlveolarO2MmHg,
    membraneGradientMmHg,
    pCapillaryO2MmHg,
    capillaryO2ContentMlPerMl,
    hemoglobinProperties: props,
    source: HUMMOD_GAS_EXCHANGE_SOURCE,
    sourceStructure: 'LungO2.CalcUptake',
  });
}

function mixOxygenAcrossShunt({
  totalPulmonaryBloodFlowMlPerMin,
  ventilatedPulmonaryBloodFlowMlPerMin,
  capillaryO2ContentMlPerMl,
  mixedVenousO2ContentMlPerMl,
} = {}) {
  nonNegative(totalPulmonaryBloodFlowMlPerMin, 'totalPulmonaryBloodFlowMlPerMin');
  nonNegative(ventilatedPulmonaryBloodFlowMlPerMin, 'ventilatedPulmonaryBloodFlowMlPerMin');
  nonNegative(capillaryO2ContentMlPerMl, 'capillaryO2ContentMlPerMl');
  nonNegative(mixedVenousO2ContentMlPerMl, 'mixedVenousO2ContentMlPerMl');

  if (ventilatedPulmonaryBloodFlowMlPerMin > totalPulmonaryBloodFlowMlPerMin) {
    throw new Error('ventilated pulmonary flow cannot exceed total pulmonary flow');
  }
  if (totalPulmonaryBloodFlowMlPerMin === 0) return 0;

  const shuntFlow =
    totalPulmonaryBloodFlowMlPerMin - ventilatedPulmonaryBloodFlowMlPerMin;

  return (
    (ventilatedPulmonaryBloodFlowMlPerMin * capillaryO2ContentMlPerMl) +
    (shuntFlow * mixedVenousO2ContentMlPerMl)
  ) / totalPulmonaryBloodFlowMlPerMin;
}

function solveCo2Exchange({
  alveolarVentilationStpdMlPerMin,
  bronchiCo2Fraction,
  barometricPressureMmHg,
  ventilatedPulmonaryBloodFlowMlPerMin,
  mixedVenousHco3MolPerL,
  sidMolPerL,
} = {}) {
  positive(alveolarVentilationStpdMlPerMin, 'alveolarVentilationStpdMlPerMin');
  fraction(bronchiCo2Fraction, 'bronchiCo2Fraction');
  positive(barometricPressureMmHg, 'barometricPressureMmHg');
  nonNegative(ventilatedPulmonaryBloodFlowMlPerMin, 'ventilatedPulmonaryBloodFlowMlPerMin');
  nonNegative(mixedVenousHco3MolPerL, 'mixedVenousHco3MolPerL');
  positive(sidMolPerL, 'sidMolPerL');

  if (ventilatedPulmonaryBloodFlowMlPerMin === 0) {
    return Object.freeze({
      expiredCo2MlPerMin: 0,
      alveolarCo2Fraction: bronchiCo2Fraction,
      pAlveolarCo2MmHg: bronchiCo2Fraction * barometricPressureMmHg,
      capillaryHco3MolPerL: mixedVenousHco3MolPerL,
      source: HUMMOD_GAS_EXCHANGE_SOURCE,
    });
  }

  function residual(expiredCo2MlPerMin) {
    const alveolarCo2Fraction =
      bronchiCo2Fraction +
      (expiredCo2MlPerMin / alveolarVentilationStpdMlPerMin);
    const pAlveolarCo2MmHg =
      alveolarCo2Fraction * barometricPressureMmHg;
    const capillaryHco3MolPerL = hco3FromPco2Sid({
      pco2MmHg: pAlveolarCo2MmHg,
      sidMolPerL,
    }).hco3MolPerL;

    const endExpiredMlPerMin =
      ventilatedPulmonaryBloodFlowMlPerMin *
      (mixedVenousHco3MolPerL - capillaryHco3MolPerL) *
      CO2_MOLS_TO_LITERS;

    return endExpiredMlPerMin - expiredCo2MlPerMin;
  }

  const high = alveolarVentilationStpdMlPerMin * 0.5;
  const expiredCo2MlPerMin = solveRootBisection({
    fn: residual,
    low: 0,
    high,
    tolerance: 1e-6,
    label: 'HumMod LungCO2 expired',
  });

  const alveolarCo2Fraction =
    bronchiCo2Fraction +
    (expiredCo2MlPerMin / alveolarVentilationStpdMlPerMin);
  const pAlveolarCo2MmHg =
    alveolarCo2Fraction * barometricPressureMmHg;
  const capillaryHco3MolPerL = hco3FromPco2Sid({
    pco2MmHg: pAlveolarCo2MmHg,
    sidMolPerL,
  }).hco3MolPerL;

  return Object.freeze({
    expiredCo2MlPerMin,
    alveolarCo2Fraction,
    pAlveolarCo2MmHg,
    pCapillaryCo2MmHg: pAlveolarCo2MmHg,
    capillaryHco3MolPerL,
    source: HUMMOD_GAS_EXCHANGE_SOURCE,
    sourceStructure: 'LungCO2.CalcExpired',
  });
}

function mixCo2AcrossShunt({
  totalPulmonaryBloodFlowMlPerMin,
  ventilatedPulmonaryBloodFlowMlPerMin,
  capillaryHco3MolPerL,
  mixedVenousHco3MolPerL,
} = {}) {
  nonNegative(totalPulmonaryBloodFlowMlPerMin, 'totalPulmonaryBloodFlowMlPerMin');
  nonNegative(ventilatedPulmonaryBloodFlowMlPerMin, 'ventilatedPulmonaryBloodFlowMlPerMin');
  nonNegative(capillaryHco3MolPerL, 'capillaryHco3MolPerL');
  nonNegative(mixedVenousHco3MolPerL, 'mixedVenousHco3MolPerL');

  if (ventilatedPulmonaryBloodFlowMlPerMin > totalPulmonaryBloodFlowMlPerMin) {
    throw new Error('ventilated pulmonary flow cannot exceed total pulmonary flow');
  }
  if (totalPulmonaryBloodFlowMlPerMin === 0) return 0;

  const shuntFlow =
    totalPulmonaryBloodFlowMlPerMin - ventilatedPulmonaryBloodFlowMlPerMin;

  return (
    (ventilatedPulmonaryBloodFlowMlPerMin * capillaryHco3MolPerL) +
    (shuntFlow * mixedVenousHco3MolPerL)
  ) / totalPulmonaryBloodFlowMlPerMin;
}

module.exports = {
  HUMMOD_GAS_EXCHANGE_SOURCE,
  BLOOD_GAS_TO_BASE_A,
  BLOOD_GAS_TO_BASE_B,
  CO2_MOLS_TO_LITERS,
  CO2_LITERS_TO_MOLS,
  O2_SOLUBILITY,
  hco3FromPco2Sid,
  o2ContentFromPo2,
  po2FromO2Content,
  solveRootBisection,
  solveOxygenExchange,
  mixOxygenAcrossShunt,
  solveCo2Exchange,
  mixCo2AcrossShunt,
};
