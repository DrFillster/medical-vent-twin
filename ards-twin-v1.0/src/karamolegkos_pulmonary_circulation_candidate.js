'use strict';

// Source-native pulmonary vascular candidate.
// Karamolegkos N, Albanese A, Chbat NW.
// IEEE Open J Eng Med Biol. 2021;2:324-341.
// DOI: 10.1109/OJEMB.2021.3128629.
//
// This module intentionally accepts source-native alveolar volume (V_A) and
// pressure/flow variables. It does NOT infer absolute V_A from Vent elastic
// compartment volume. That cross-model adapter is a separate provenance gate.

const SOURCE = Object.freeze({
  citation:
    'Karamolegkos N, Albanese A, Chbat NW. Heart-Lung Interactions During Mechanical Ventilation: Analysis via a Cardiopulmonary Simulation Model. IEEE Open J Eng Med Biol. 2021;2:324-341.',
  doi: '10.1109/OJEMB.2021.3128629',
  pmcid: 'PMC8975239',
  authority: 'primary-paper-equations',
});

const PARAMETERS = Object.freeze({
  CpaMlPerMmHg: 0.76,
  VupaMl: 0,
  RpaMmHgSecPerMl: 0.023,
  LpaMmHgSec2PerMl: 1.8e-4,
  CpalMlPerMmHg: 1.93,
  VupalMl: 43.30,
  CpcMlPerMmHg: 3.87,
  VupcMl: 64.94,
  RppTotalMmHgSecPerMl: 0.0894,
  CpvMlPerMmHg: 25.37,
  VupvMl: 105.6,
  RpvMmHgSecPerMl: 0.0056,
  frcNominalL: 2.25,
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

function shuntFraction(v) {
  finite(v, 'shuntFraction');
  if (v < 0 || v >= 1) throw new Error('shuntFraction must be in [0,1)');
  return v;
}

// Paper Eq. 3.
function pulmonaryArteriolarResistance({
  alveolarVolumeL,
  shuntFraction: sh,
  totalPeripheralResistanceMmHgSecPerMl =
    PARAMETERS.RppTotalMmHgSecPerMl,
  frcNominalL = PARAMETERS.frcNominalL,
} = {}) {
  positive(alveolarVolumeL, 'alveolarVolumeL');
  shuntFraction(sh);
  positive(totalPeripheralResistanceMmHgSecPerMl,
    'totalPeripheralResistanceMmHgSecPerMl');
  positive(frcNominalL, 'frcNominalL');

  return totalPeripheralResistanceMmHgSecPerMl /
    (2 * (1 - sh)) *
    Math.pow(alveolarVolumeL / frcNominalL, 2);
}

// Appendix A15.
function pulmonaryShuntFlow({
  nonShuntArteriolarFlowMlPerSec,
  shuntFraction: sh,
} = {}) {
  finite(nonShuntArteriolarFlowMlPerSec, 'nonShuntArteriolarFlowMlPerSec');
  shuntFraction(sh);
  return sh / (1 - sh) * nonShuntArteriolarFlowMlPerSec;
}

// Appendix A8.
function totalPeripheralFlow({
  nonShuntArteriolarFlowMlPerSec,
  shuntFraction: sh,
} = {}) {
  finite(nonShuntArteriolarFlowMlPerSec, 'nonShuntArteriolarFlowMlPerSec');
  shuntFraction(sh);
  return nonShuntArteriolarFlowMlPerSec / (1 - sh);
}

// Appendix A9 using source Eq. 3 for R_pal.
function nonShuntArteriolarFlow({
  pulmonaryArteriolarPressureMmHg,
  pulmonaryCapillaryPressureMmHg,
  alveolarVolumeL,
  shuntFraction: sh,
} = {}) {
  finite(pulmonaryArteriolarPressureMmHg, 'pulmonaryArteriolarPressureMmHg');
  finite(pulmonaryCapillaryPressureMmHg, 'pulmonaryCapillaryPressureMmHg');
  const r = pulmonaryArteriolarResistance({
    alveolarVolumeL,
    shuntFraction: sh,
  });
  return (pulmonaryArteriolarPressureMmHg -
    pulmonaryCapillaryPressureMmHg) / r;
}

// Appendix A25. Post-capillary resistance is source-derived from total
// pulmonary peripheral resistance and selected shunt fraction.
function pulmonaryCapillaryResistance({
  shuntFraction: sh,
  totalPeripheralResistanceMmHgSecPerMl =
    PARAMETERS.RppTotalMmHgSecPerMl,
} = {}) {
  shuntFraction(sh);
  positive(totalPeripheralResistanceMmHgSecPerMl,
    'totalPeripheralResistanceMmHgSecPerMl');
  return totalPeripheralResistanceMmHgSecPerMl /
    (2 * (1 - sh));
}

// Appendix A12 using source Appendix A25 for R_pc.
function pulmonaryCapillaryFlow({
  pulmonaryCapillaryPressureMmHg,
  pulmonaryVenousPressureMmHg,
  shuntFraction: sh,
} = {}) {
  finite(pulmonaryCapillaryPressureMmHg, 'pulmonaryCapillaryPressureMmHg');
  finite(pulmonaryVenousPressureMmHg, 'pulmonaryVenousPressureMmHg');
  const capillaryResistanceMmHgSecPerMl =
    pulmonaryCapillaryResistance({shuntFraction:sh});
  return (pulmonaryCapillaryPressureMmHg -
    pulmonaryVenousPressureMmHg) / capillaryResistanceMmHgSecPerMl;
}

// Appendix A16.
function pulmonaryVenousFlow({
  pulmonaryVenousPressureMmHg,
  leftAtrialPressureMmHg,
  venousResistanceMmHgSecPerMl = PARAMETERS.RpvMmHgSecPerMl,
} = {}) {
  finite(pulmonaryVenousPressureMmHg, 'pulmonaryVenousPressureMmHg');
  finite(leftAtrialPressureMmHg, 'leftAtrialPressureMmHg');
  positive(venousResistanceMmHgSecPerMl, 'venousResistanceMmHgSecPerMl');
  return (pulmonaryVenousPressureMmHg - leftAtrialPressureMmHg) /
    venousResistanceMmHgSecPerMl;
}

function compliantVolume({
  internalPressureMmHg,
  externalPressureMmHg,
  complianceMlPerMmHg,
  unstressedVolumeMl,
} = {}) {
  finite(internalPressureMmHg, 'internalPressureMmHg');
  finite(externalPressureMmHg, 'externalPressureMmHg');
  positive(complianceMlPerMmHg, 'complianceMlPerMmHg');
  finite(unstressedVolumeMl, 'unstressedVolumeMl');
  return complianceMlPerMmHg *
    (internalPressureMmHg - externalPressureMmHg) +
    unstressedVolumeMl;
}

function pulmonaryArteryVolume({ pressureMmHg, pleuralPressureMmHg } = {}) {
  return compliantVolume({
    internalPressureMmHg: pressureMmHg,
    externalPressureMmHg: pleuralPressureMmHg,
    complianceMlPerMmHg: PARAMETERS.CpaMlPerMmHg,
    unstressedVolumeMl: PARAMETERS.VupaMl,
  });
}

function pulmonaryArteriolarVolume({ pressureMmHg, pleuralPressureMmHg } = {}) {
  return compliantVolume({
    internalPressureMmHg: pressureMmHg,
    externalPressureMmHg: pleuralPressureMmHg,
    complianceMlPerMmHg: PARAMETERS.CpalMlPerMmHg,
    unstressedVolumeMl: PARAMETERS.VupalMl,
  });
}

function pulmonaryCapillaryVolume({ pressureMmHg, alveolarPressureMmHg } = {}) {
  return compliantVolume({
    internalPressureMmHg: pressureMmHg,
    externalPressureMmHg: alveolarPressureMmHg,
    complianceMlPerMmHg: PARAMETERS.CpcMlPerMmHg,
    unstressedVolumeMl: PARAMETERS.VupcMl,
  });
}

function pulmonaryVenousVolume({ pressureMmHg, pleuralPressureMmHg } = {}) {
  return compliantVolume({
    internalPressureMmHg: pressureMmHg,
    externalPressureMmHg: pleuralPressureMmHg,
    complianceMlPerMmHg: PARAMETERS.CpvMlPerMmHg,
    unstressedVolumeMl: PARAMETERS.VupvMl,
  });
}

// A4, A7, A11, A14 return derivative of the source transmural pressure
// coordinate (P_internal - P_external), not absolute pressure.
function dPulmonaryArteryTransmuralPressureDt({
  rvOutflowMlPerSec,
  pulmonaryArterialFlowMlPerSec,
} = {}) {
  finite(rvOutflowMlPerSec, 'rvOutflowMlPerSec');
  finite(pulmonaryArterialFlowMlPerSec, 'pulmonaryArterialFlowMlPerSec');
  return (rvOutflowMlPerSec - pulmonaryArterialFlowMlPerSec) /
    PARAMETERS.CpaMlPerMmHg;
}

function dPulmonaryArterialFlowDt({
  pulmonaryArteryPressureMmHg,
  pulmonaryArteriolarPressureMmHg,
  pulmonaryArterialFlowMlPerSec,
} = {}) {
  finite(pulmonaryArteryPressureMmHg, 'pulmonaryArteryPressureMmHg');
  finite(pulmonaryArteriolarPressureMmHg, 'pulmonaryArteriolarPressureMmHg');
  finite(pulmonaryArterialFlowMlPerSec, 'pulmonaryArterialFlowMlPerSec');
  return (pulmonaryArteryPressureMmHg -
    pulmonaryArteriolarPressureMmHg -
    PARAMETERS.RpaMmHgSecPerMl * pulmonaryArterialFlowMlPerSec) /
    PARAMETERS.LpaMmHgSec2PerMl;
}

function dPulmonaryArteriolarTransmuralPressureDt({
  pulmonaryArterialFlowMlPerSec,
  nonShuntArteriolarFlowMlPerSec,
  shuntFlowMlPerSec,
} = {}) {
  finite(pulmonaryArterialFlowMlPerSec, 'pulmonaryArterialFlowMlPerSec');
  finite(nonShuntArteriolarFlowMlPerSec, 'nonShuntArteriolarFlowMlPerSec');
  finite(shuntFlowMlPerSec, 'shuntFlowMlPerSec');
  return (pulmonaryArterialFlowMlPerSec -
    nonShuntArteriolarFlowMlPerSec - shuntFlowMlPerSec) /
    PARAMETERS.CpalMlPerMmHg;
}

function dPulmonaryCapillaryTransmuralPressureDt({
  nonShuntArteriolarFlowMlPerSec,
  pulmonaryCapillaryFlowMlPerSec,
} = {}) {
  finite(nonShuntArteriolarFlowMlPerSec, 'nonShuntArteriolarFlowMlPerSec');
  finite(pulmonaryCapillaryFlowMlPerSec, 'pulmonaryCapillaryFlowMlPerSec');
  return (nonShuntArteriolarFlowMlPerSec -
    pulmonaryCapillaryFlowMlPerSec) / PARAMETERS.CpcMlPerMmHg;
}

function dPulmonaryVenousTransmuralPressureDt({
  shuntFlowMlPerSec,
  pulmonaryCapillaryFlowMlPerSec,
  pulmonaryVenousFlowMlPerSec,
} = {}) {
  finite(shuntFlowMlPerSec, 'shuntFlowMlPerSec');
  finite(pulmonaryCapillaryFlowMlPerSec, 'pulmonaryCapillaryFlowMlPerSec');
  finite(pulmonaryVenousFlowMlPerSec, 'pulmonaryVenousFlowMlPerSec');
  return (shuntFlowMlPerSec + pulmonaryCapillaryFlowMlPerSec -
    pulmonaryVenousFlowMlPerSec) / PARAMETERS.CpvMlPerMmHg;
}

module.exports = Object.freeze({
  SOURCE,
  PARAMETERS,
  pulmonaryArteriolarResistance,
  pulmonaryShuntFlow,
  totalPeripheralFlow,
  nonShuntArteriolarFlow,
  pulmonaryCapillaryResistance,
  pulmonaryCapillaryFlow,
  pulmonaryVenousFlow,
  compliantVolume,
  pulmonaryArteryVolume,
  pulmonaryArteriolarVolume,
  pulmonaryCapillaryVolume,
  pulmonaryVenousVolume,
  dPulmonaryArteryTransmuralPressureDt,
  dPulmonaryArterialFlowDt,
  dPulmonaryArteriolarTransmuralPressureDt,
  dPulmonaryCapillaryTransmuralPressureDt,
  dPulmonaryVenousTransmuralPressureDt,
});
