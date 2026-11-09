'use strict';

const SOURCE = Object.freeze({
  citation:
    'Hennigs C et al. Validation of a Computational Respiratory System Model for Mechanical Ventilation. arXiv:2607.06210v2 (2026).',
  equations: 'GE7, BL3',
  authority: 'candidate-not-canonical',
  controlAuthority: false,
  parameters: Object.freeze({
    brainTissueVolumeL: 0.90,
    brainCo2ProductionLPerMin: 0.05,
    hemoglobinMolPerL: 2e-3,
    co2SolubilityLPerMmHg: 0.0301,
    concentrationScale: 2.226,
  }),
  limitation:
    'Brain pH and local virtual O2 saturation are required for BL3 inversion; arterial values are not substituted.',
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
function unitInterval(v, label) {
  finite(v, label);
  if (v < 0 || v > 1) throw new Error(label + ' must be in [0,1]');
  return v;
}

function co2ConcentrationLPerL({
  pco2MmHg,
  pH,
  virtualO2SaturationFraction,
  hemoglobinMolPerL = SOURCE.parameters.hemoglobinMolPerL,
} = {}) {
  positive(pco2MmHg, 'pco2MmHg');
  finite(pH, 'pH');
  unitInterval(virtualO2SaturationFraction, 'virtualO2SaturationFraction');
  positive(hemoglobinMolPerL, 'hemoglobinMolPerL');

  const correction =
    1 -
    (0.02924 * hemoglobinMolPerL) /
      (2.244 -
        0.422 * virtualO2SaturationFraction * (8.74 - pH));
  if (!(correction > 0)) {
    throw new Error('BL3 hemoglobin correction became non-physical');
  }
  return (
    correction *
    SOURCE.parameters.co2SolubilityLPerMmHg *
    pco2MmHg *
    (1 + Math.pow(10, pH - 6.1)) *
    SOURCE.parameters.concentrationScale
  );
}

function pco2FromConcentrationMmHg({
  concentrationLPerL,
  pH,
  virtualO2SaturationFraction,
  hemoglobinMolPerL = SOURCE.parameters.hemoglobinMolPerL,
} = {}) {
  positive(concentrationLPerL, 'concentrationLPerL');
  finite(pH, 'pH');
  unitInterval(virtualO2SaturationFraction, 'virtualO2SaturationFraction');
  positive(hemoglobinMolPerL, 'hemoglobinMolPerL');

  // BL3 is linear in PCO2 once pH and virtual O2 saturation are fixed.
  const perMmHg = co2ConcentrationLPerL({
    pco2MmHg: 1,
    pH,
    virtualO2SaturationFraction,
    hemoglobinMolPerL,
  });
  return concentrationLPerL / perMmHg;
}

function createHennigsBrainCo2TransportCandidate({
  initialBrainPco2MmHg,
  initialBrainPh,
  initialBrainVirtualO2SaturationFraction,
  brainTissueVolumeL = SOURCE.parameters.brainTissueVolumeL,
  brainCo2ProductionLPerMin = SOURCE.parameters.brainCo2ProductionLPerMin,
} = {}) {
  positive(initialBrainPco2MmHg, 'initialBrainPco2MmHg');
  finite(initialBrainPh, 'initialBrainPh');
  unitInterval(
    initialBrainVirtualO2SaturationFraction,
    'initialBrainVirtualO2SaturationFraction'
  );
  positive(brainTissueVolumeL, 'brainTissueVolumeL');
  positive(brainCo2ProductionLPerMin, 'brainCo2ProductionLPerMin');

  let brainCo2ConcentrationLPerL = co2ConcentrationLPerL({
    pco2MmHg: initialBrainPco2MmHg,
    pH: initialBrainPh,
    virtualO2SaturationFraction:
      initialBrainVirtualO2SaturationFraction,
  });
  let timeSec = 0;
  let last = null;

  function step({
    dtSec,
    arterialPco2MmHg,
    arterialPh,
    arterialVirtualO2SaturationFraction,
    cerebralFlowLPerMin,
    brainPh,
    brainVirtualO2SaturationFraction,
  } = {}) {
    positive(dtSec, 'dtSec');
    positive(arterialPco2MmHg, 'arterialPco2MmHg');
    finite(arterialPh, 'arterialPh');
    unitInterval(
      arterialVirtualO2SaturationFraction,
      'arterialVirtualO2SaturationFraction'
    );
    positive(cerebralFlowLPerMin, 'cerebralFlowLPerMin');
    finite(brainPh, 'brainPh');
    unitInterval(
      brainVirtualO2SaturationFraction,
      'brainVirtualO2SaturationFraction'
    );

    const arterialCo2ConcentrationLPerL = co2ConcentrationLPerL({
      pco2MmHg: arterialPco2MmHg,
      pH: arterialPh,
      virtualO2SaturationFraction:
        arterialVirtualO2SaturationFraction,
    });

    // GE7 uses minutes. Convert dtSec to minutes for a unit-consistent
    // concentration update.
    const dtMin = dtSec / 60;
    const derivativePerMin =
      (
        cerebralFlowLPerMin *
          (arterialCo2ConcentrationLPerL -
            brainCo2ConcentrationLPerL) +
        brainCo2ProductionLPerMin
      ) / brainTissueVolumeL;

    brainCo2ConcentrationLPerL += derivativePerMin * dtMin;
    positive(
      brainCo2ConcentrationLPerL,
      'brainCo2ConcentrationLPerL'
    );

    const brainPco2MmHg = pco2FromConcentrationMmHg({
      concentrationLPerL: brainCo2ConcentrationLPerL,
      pH: brainPh,
      virtualO2SaturationFraction:
        brainVirtualO2SaturationFraction,
    });

    timeSec += dtSec;
    last = Object.freeze({
      timeSec,
      arterialCo2ConcentrationLPerL,
      brainCo2ConcentrationLPerL,
      brainPco2MmHg,
      cerebralFlowLPerMin,
      brainPh,
      brainVirtualO2SaturationFraction,
      authority: SOURCE.authority,
      controlAuthority: false,
      provenance: SOURCE,
    });
    return last;
  }

  function snapshot() {
    return last || Object.freeze({
      timeSec,
      arterialCo2ConcentrationLPerL: null,
      brainCo2ConcentrationLPerL,
      brainPco2MmHg: pco2FromConcentrationMmHg({
        concentrationLPerL: brainCo2ConcentrationLPerL,
        pH: initialBrainPh,
        virtualO2SaturationFraction:
          initialBrainVirtualO2SaturationFraction,
      }),
      cerebralFlowLPerMin: null,
      brainPh: initialBrainPh,
      brainVirtualO2SaturationFraction:
        initialBrainVirtualO2SaturationFraction,
      authority: SOURCE.authority,
      controlAuthority: false,
      provenance: SOURCE,
    });
  }

  return Object.freeze({
    step,
    snapshot,
    source: SOURCE,
  });
}

module.exports = Object.freeze({
  SOURCE,
  co2ConcentrationLPerL,
  pco2FromConcentrationMmHg,
  createHennigsBrainCo2TransportCandidate,
});
