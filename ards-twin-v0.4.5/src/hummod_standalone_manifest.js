'use strict';

// hummod_standalone_manifest.js
//
// Source-of-truth manifest for HumMod standalone symbols that have been
// inspected directly in the pinned upstream source revision. This file does
// NOT assume a runtime/export object shape. `symbol` is the HumMod model symbol;
// a later exporter must explicitly bind each symbol to a concrete JSON path.
//
// Do not add an entry as `verified` from search results or name similarity.
// Verify the defining .DES file in the pinned revision first.

const HUMMOD_STANDALONE_UPSTREAM = Object.freeze({
  repository: 'riliescu/hummod-standalone',
  revision: '8dab57e05631f779bf5020fe0dd51874d8ae98c1',
  schemaFamily: 'DES V1.0 / HumMod standalone',
});

const HUMMOD_STANDALONE_SYMBOLS = Object.freeze({
  arterialPaO2: Object.freeze({
    normalizedTarget: 'gasExchange.pao2MmHg',
    symbol: 'PO2Artys.Pressure',
    sourceFile: 'Structure/O2/PO2Artys.DES',
    normalizedUnit: 'mmHg',
    status: 'verified-source-symbol',
    note: 'PO2Artys copies HgbLung.pO2 into Pressure.',
  }),

  arterialO2SaturationPercent: Object.freeze({
    normalizedTarget: 'gasExchange.spo2Fraction',
    symbol: 'PO2Artys.Sat(%)',
    sourceFile: 'Structure/O2/PO2Artys.DES',
    sourceUnit: 'percent',
    normalizedUnit: 'fraction',
    status: 'verified-source-symbol-requires-explicit-unit-transform',
    note: 'Do not map directly until the export adapter declares percent-to-fraction conversion.',
  }),

  arterialPaCO2: Object.freeze({
    normalizedTarget: 'gasExchange.paco2MmHg',
    symbol: 'CO2Artys.Pressure',
    sourceFile: 'Structure/CO2/CO2Artys.DES',
    normalizedUnit: 'mmHg',
    status: 'verified-source-symbol',
    note: 'CO2Artys obtains Pressure from Blood-BaseToGas.pCO2.',
  }),

  arterialPh: Object.freeze({
    normalizedTarget: 'gasExchange.ph',
    symbol: 'BloodPh.ArtysPh',
    sourceFile: 'Structure/AcidBase/BloodPh.DES',
    normalizedUnit: 'pH',
    status: 'verified-source-symbol',
    note: 'BloodPh copies PhBlood.pH into ArtysPh.',
  }),

  heartRate: Object.freeze({
    normalizedTarget: 'hemodynamics.heartRatePerMin',
    symbol: 'Heart-Rate.Rate',
    sourceFile: 'Structure/Heart/Heart-Rate.DES',
    normalizedUnit: '1/min',
    status: 'verified-source-symbol',
    note: 'Heart-Rate.Rate is assigned from Heart-Ventricles.Rate.',
  }),

  meanArterialPressure: Object.freeze({
    normalizedTarget: 'hemodynamics.meanArterialPressureMmHg',
    symbol: 'SystemicArtys.Pressure',
    sourceFile: 'Structure/VascularCompartments/SystemicArtys.DES',
    normalizedUnit: 'mmHg',
    status: 'verified-source-symbol',
    note: 'SystemicArtys uses Pressure as the mean arterial pressure and separately derives SBP/DBP; its Wrapup converts Pressure to MeanBP(kPa).',
  }),

  cardiacOutput: Object.freeze({
    normalizedTarget: 'hemodynamics.cardiacOutputLPerMin',
    symbol: 'CardiacOutput.Flow(L/Min)',
    sourceFile: 'Structure/Circulation/CardiacOutput.DES',
    normalizedUnit: 'L/min',
    status: 'verified-source-symbol',
    note: 'HumMod explicitly defines Flow(L/Min) = Flow / 1000.',
  }),

  rightAtrialPressure: Object.freeze({
    normalizedTarget: null,
    candidateNormalizedTarget: 'hemodynamics.centralVenousPressureMmHg',
    symbol: 'RightAtrium.Pressure',
    sourceFile: 'Structure/VascularCompartments/RightAtrium.DES',
    normalizedUnit: 'mmHg',
    status: 'verified-source-symbol-semantic-mapping-pending',
    note: 'Right atrial pressure is directly modeled, but the project has not yet declared it interchangeable with normalized CVP.',
  }),

  wholeBodyO2Outflow: Object.freeze({
    normalizedTarget: null,
    candidateNormalizedTarget: 'metabolism.oxygenConsumptionMlPerMin',
    symbol: 'O2Total.Outflow',
    sourceFile: 'Structure/O2/O2Total.DES',
    status: 'verified-source-symbol-unit-verification-pending',
    note: 'O2Total.Outflow sums organ O2Use terms. Do not normalize until source units are verified end-to-end.',
  }),

  wholeBodyCO2Inflow: Object.freeze({
    normalizedTarget: null,
    candidateNormalizedTarget: 'metabolism.co2ProductionMlPerMin',
    symbol: 'CO2Total.Inflow',
    sourceFile: 'Structure/CO2/CO2Total.DES',
    status: 'verified-source-symbol-unit-verification-pending',
    note: 'CO2Total.Inflow sums organ CO2 OutflowBase terms. Do not normalize until source units are verified end-to-end.',
  }),

  timestamp: Object.freeze({
    normalizedTarget: 'timestampSec',
    symbol: null,
    sourceFile: null,
    normalizedUnit: 's',
    status: 'export-envelope-required',
    note: 'Timestamp is supplied by the HumMod execution/export layer; no physiological model symbol is asserted here.',
  }),
});

function listVerifiedDirectMappings() {
  return Object.values(HUMMOD_STANDALONE_SYMBOLS)
    .filter(entry => entry.normalizedTarget && entry.symbol && entry.status === 'verified-source-symbol')
    .map(entry => Object.freeze({
      target: entry.normalizedTarget,
      symbol: entry.symbol,
      sourceFile: entry.sourceFile,
      unit: entry.normalizedUnit,
    }));
}

module.exports = {
  HUMMOD_STANDALONE_UPSTREAM,
  HUMMOD_STANDALONE_SYMBOLS,
  listVerifiedDirectMappings,
};
