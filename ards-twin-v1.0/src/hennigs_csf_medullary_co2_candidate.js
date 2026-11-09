'use strict';

const SOURCE = Object.freeze({
  citation:
    'Hennigs C et al. Validation of a Computational Respiratory System Model for Mechanical Ventilation. arXiv:2607.06210v2 (2026).',
  equations: 'GE8, GE9, BL2',
  authority: 'candidate-not-canonical',
  controlAuthority: false,
  parameters: Object.freeze({
    csfTauSec: 320,
    cerebralExchangeK: 1.139,
  }),
  limitation:
    'Brain PCO2, cerebral flow, and medullary bicarbonate must come from explicit source-valid providers; arterial or venous PCO2 is not substituted.',
});

function finite(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(label + ' must be finite');
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

function hendersonHasselbalchPh({
  pco2MmHg,
  bicarbonateMmolPerL,
} = {}) {
  positive(pco2MmHg, 'pco2MmHg');
  positive(bicarbonateMmolPerL, 'bicarbonateMmolPerL');
  return 6.1 + Math.log10(
    bicarbonateMmolPerL / (0.03 * pco2MmHg)
  );
}

function createHennigsCsfMedullaryCo2Candidate({
  initialCsfPco2MmHg,
  csfTauSec = SOURCE.parameters.csfTauSec,
  cerebralExchangeK = SOURCE.parameters.cerebralExchangeK,
} = {}) {
  positive(initialCsfPco2MmHg, 'initialCsfPco2MmHg');
  positive(csfTauSec, 'csfTauSec');
  positive(cerebralExchangeK, 'cerebralExchangeK');

  let csfPco2MmHg = initialCsfPco2MmHg;
  let timeSec = 0;
  let last = null;

  function step({
    dtSec,
    brainPco2MmHg,
    cerebralFlowLPerMin,
  } = {}) {
    positive(dtSec, 'dtSec');
    positive(brainPco2MmHg, 'brainPco2MmHg');
    nonNegative(cerebralFlowLPerMin, 'cerebralFlowLPerMin');

    // Validation model GE8:
    // dPcsfCO2/dt = (PbCO2 - PcsfCO2) / tauCSF
    const decay = Math.exp(-dtSec / csfTauSec);
    csfPco2MmHg =
      brainPco2MmHg +
      (csfPco2MmHg - brainPco2MmHg) * decay;

    // Validation model GE9:
    // PmCO2 = PbCO2 + (PcsfCO2 - PbCO2) * exp(-kcr*sqrt(Qb))
    const exchangeWeight = Math.exp(
      -cerebralExchangeK * Math.sqrt(cerebralFlowLPerMin)
    );
    const medullaryPco2MmHg =
      brainPco2MmHg +
      (csfPco2MmHg - brainPco2MmHg) * exchangeWeight;

    timeSec += dtSec;
    last = Object.freeze({
      timeSec,
      brainPco2MmHg,
      csfPco2MmHg,
      medullaryPco2MmHg,
      cerebralFlowLPerMin,
      exchangeWeight,
      authority: SOURCE.authority,
      controlAuthority: false,
      provenance: SOURCE,
    });
    return last;
  }

  function snapshot() {
    return last || Object.freeze({
      timeSec,
      brainPco2MmHg: null,
      csfPco2MmHg,
      medullaryPco2MmHg: null,
      cerebralFlowLPerMin: null,
      exchangeWeight: null,
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
  hendersonHasselbalchPh,
  createHennigsCsfMedullaryCo2Candidate,
});
