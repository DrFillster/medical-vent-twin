'use strict';

// hummod_ards_core_manifest.js
//
// First-pass contract for a reduced-order cardiopulmonary/systemic core built
// around the pinned HumMod source. This is an engineering extraction target,
// not a claim that these symbols alone constitute an independently runnable
// HumMod model.
//
// Design rule: keep only physiology that can materially change an acute
// ventilator/ARDS simulation over seconds-to-tens-of-minutes. Slow systems are
// held at explicit boundary inputs until later phases.

const HUMMOD_ARDS_CORE_SCHEMA = 'hummod-ards-core/v1';

const HUMMOD_ARDS_CORE = Object.freeze({
  schema: HUMMOD_ARDS_CORE_SCHEMA,
  source: Object.freeze({
    repository: 'riliescu/hummod-standalone',
    revision: '8dab57e05631f779bf5020fe0dd51874d8ae98c1',
  }),

  timeHorizon: Object.freeze({
    intended: 'seconds-to-tens-of-minutes',
    laterExpansion: 'hours-to-days after acute core is validated',
  }),

  outputs: Object.freeze([
    Object.freeze({
      domain: 'gas-exchange',
      symbol: 'PO2Artys.Pressure',
      normalizedName: 'pao2MmHg',
      status: 'verified-source-symbol',
      sourcePath: 'Structure/O2/PO2Artys.DES',
    }),
    Object.freeze({
      domain: 'gas-exchange',
      symbol: 'PO2Artys.Sat(%)',
      normalizedName: 'sao2Percent',
      status: 'verified-source-symbol-unit-transform-required',
      sourcePath: 'Structure/O2/PO2Artys.DES',
    }),
    Object.freeze({
      domain: 'gas-exchange',
      symbol: 'CO2Artys.Pressure',
      normalizedName: 'paco2MmHg',
      status: 'verified-source-symbol',
      sourcePath: 'Structure/CO2/CO2Artys.DES',
    }),
    Object.freeze({
      domain: 'acid-base',
      symbol: 'CO2Artys.[HCO3(mEq/L)]',
      normalizedName: 'hco3MeqPerL',
      status: 'verified-source-symbol',
      sourcePath: 'Structure/CO2/CO2Artys.DES',
    }),
    Object.freeze({
      domain: 'acid-base',
      symbol: 'BloodPh.ArtysPh',
      normalizedName: 'arterialPh',
      status: 'verified-source-symbol',
      sourcePath: 'Structure/AcidBase/BloodPh.DES',
    }),
    Object.freeze({
      domain: 'systemic-hemodynamics',
      symbol: 'Heart-Rate.Rate',
      normalizedName: 'heartRatePerMin',
      status: 'verified-source-symbol',
      sourcePath: 'Structure/Heart/Heart-Rate.DES',
    }),
    Object.freeze({
      domain: 'systemic-hemodynamics',
      symbol: 'SystemicArtys.Pressure',
      normalizedName: 'meanArterialPressureMmHg',
      status: 'verified-source-symbol',
      sourcePath: 'Structure/VascularCompartments/SystemicArtys.DES',
    }),
    Object.freeze({
      domain: 'systemic-hemodynamics',
      symbol: 'CardiacOutput.Flow(L/Min)',
      normalizedName: 'cardiacOutputLPerMin',
      status: 'verified-source-symbol',
      sourcePath: 'Structure/Circulation/CardiacOutput.DES',
    }),
    Object.freeze({
      domain: 'right-heart',
      symbol: 'RightAtrium.Pressure',
      normalizedName: 'rightAtrialPressureMmHg',
      status: 'verified-source-symbol',
      sourcePath: 'Structure/VascularCompartments/RightAtrium.DES',
    }),
    Object.freeze({
      domain: 'pulmonary-circulation',
      symbol: 'PulmArty.Pressure',
      normalizedName: 'meanPulmonaryArteryPressureMmHg',
      status: 'verified-source-symbol',
      sourcePath: 'Structure/VascularCompartments/PulmArty.DES',
    }),
  ]),

  ventToCoreBoundary: Object.freeze([
    Object.freeze({
      name: 'thoracicPressure',
      role: 'transmit positive-pressure ventilation to intrathoracic vascular compartments',
      humModDependencyEvidence: Object.freeze([
        'PulmArty.ExternalPressure <- Thorax.AvePressure',
        'RightAtrium.ExternalPressure <- Pericardium-Cavity.Pressure',
      ]),
      status: 'coupling-interface-required',
    }),
    Object.freeze({
      name: 'alveolarAndTranspulmonaryPressure',
      role: 'drive pulmonary vascular loading and gas-exchange state',
      status: 'coupling-interface-required',
    }),
    Object.freeze({
      name: 'regionalVentilation',
      role: 'supply compartmental ventilation/recruitment to gas-exchange model',
      status: 'coupling-interface-required',
    }),
    Object.freeze({
      name: 'alveolarVentilation',
      role: 'drive carbon-dioxide elimination',
      status: 'coupling-interface-required',
    }),
    Object.freeze({
      name: 'fio2',
      role: 'inspired oxygen boundary condition',
      status: 'coupling-interface-required',
    }),
    Object.freeze({
      name: 'shuntAndDeadSpace',
      role: 'connect heterogeneous lung state to arterial oxygenation and CO2 elimination',
      status: 'coupling-interface-required',
    }),
  ]),

  initialExternalizedBoundaries: Object.freeze([
    Object.freeze({
      concept: 'metabolic oxygen consumption',
      sourceSymbolCandidate: 'O2Total.Outflow',
      status: 'verified-symbol-units-and-core-role-still-to-be-traced',
      phase: 1,
    }),
    Object.freeze({
      concept: 'metabolic carbon-dioxide production',
      sourceSymbolCandidate: 'CO2Total.Inflow',
      status: 'verified-symbol-units-and-core-role-still-to-be-traced',
      phase: 1,
    }),
    Object.freeze({
      concept: 'circulating volume / stressed volume baseline',
      status: 'explicit-scenario-boundary-in-phase-1',
      phase: 1,
    }),
    Object.freeze({
      concept: 'slow endocrine and renal regulation',
      status: 'held-at-baseline-in-phase-1',
      phase: 2,
    }),
    Object.freeze({
      concept: 'thermoregulation, reproductive physiology, exercise adaptation',
      status: 'excluded-from-ARDS-core',
      phase: 'out-of-scope-initially',
    }),
  ]),

  requiredValidationExperiments: Object.freeze([
    'FiO2 step -> arterial oxygen transient',
    'minute-ventilation step -> PaCO2 and pH transient',
    'PEEP step in recruitable lung -> mechanics/gas/hemodynamic response',
    'PEEP step in poorly recruitable lung -> overdistension/RV-loading response',
    'tidal-volume/driving-pressure step -> pulmonary-vascular/RV response',
  ]),
});

const HUMMOD_ARDS_CORE_PHASE1_POLICY = Object.freeze({
  id: 'acute-cardiopulmonary-phase1',
  interpretation: 'Traverse acute cardiopulmonary dependencies; stop at explicitly externalized or later-phase systems.',
  stopSystemBuckets: Object.freeze([
    'Nephrons',
    'Kidney',
    'TissueH2O',
    'Heat',
    'AnesthesiaGas',
    'AnesthesiaIV',
    'Drugs',
    'Brain',
    'SkeletalMuscle',
    'RespiratoryMuscle',
    'Bone',
    'Fat',
    'GITract',
    'GILumen',
    'Liver',
    'LiverMetabolism',
    'OtherTissue',
    'Skin',
    'Diet',
    'Exercise',
    'Hemodialysis',
    'Sweat',
    'Glucose',
    'Insulin',
    'Glucagon',
    'Leptin',
    'ThyroidGland',
    'Ketoacid',
    'Creatine',
    'Creatinine',
    'Urea',
    'AminoAcid',
    'FattyAcid',
    'Triglyceride',
    'DailyPlanner',
    'Orthostatics',
    'TiltTable',
    'Gravity',
    'Posture',
    'Hemorrhage',
    'Transfusion',
    'IVDrip',
    'CPR',
  ]),
  stopStructureNames: Object.freeze([
    // Acute core v0 accepts metabolic demand as a boundary rather than
    // importing every tissue-metabolism subsystem.
    'O2Total',
    'CO2Total',
  ]),
  laterPhaseSystemBuckets: Object.freeze([
    'Renin',
    'ADH',
    'Aldosterone',
    'ANP',
    'Catechols',
    'Nerves',
    'Hypothalamus',
  ]),
});


const HUMMOD_V13_FIDELITY_ROOT_STRUCTURES = Object.freeze([
  'Heart-Rate',
  'SANode-Rate',
  'CardiacOutput',
  'SystemicArtys',
  'RightAtrium',
  'PulmArty',
  'PO2Artys',
  'CO2Artys',
  'BloodPh',
  'SympsCNS',
  'VagusNerve',
  'Baroreflex',
  'LowPressureReceptors',
  'Mechanoreceptors',
  'ExerciseSymps',
  'AdrenalNerve',
  'EpiSecretion',
  'EpiPool',
  'NESecretion',
  'NEPool',
  'BloodVol',
  'Brain-Function',
  'Brain-Flow',
  'Brain-Fuel',
  'SkeletalMuscle-Work',
  'SkeletalMuscle-Metabolism',
  'SkeletalMuscle-Flow',
  'SkeletalMuscle-Metaboreflex',
  'SkeletalMuscle-MusclePumping',
  'RespiratoryCenter-Exercise',
  'Exercise-Control',
  'Exercise-Bike',
  'Hemorrhage',
]);

const HUMMOD_V13_FIDELITY_POLICY = Object.freeze({
  id: 'v1.3-hummod-first-fidelity-closure',
  interpretation: 'Expand the acute browser model toward native HumMod dependency closure. Autonomics, catecholamines, brain, skeletal muscle/exercise, and hemorrhage/volume are no longer treated as optional clinical overlays.',
  stopSystemBuckets: Object.freeze([
    'Reproduction',
    'Pregnancy',
    'Fetus',
    'MenstrualCycle',
  ]),
  stopStructureNames: Object.freeze([]),
  laterPhaseSystemBuckets: Object.freeze([
    'Nephrons',
    'Kidney',
    'Renin',
    'Aldosterone',
    'ANP',
    'Diet',
    'DailyPlanner',
  ]),
});

function hummodArdsCoreRootSymbols() {
  return HUMMOD_ARDS_CORE.outputs.map(x => x.symbol);
}

function hummodArdsCoreRootStructures() {
  return [...new Set(hummodArdsCoreRootSymbols().map(symbol => symbol.split('.')[0]))];
}

module.exports = {
  HUMMOD_ARDS_CORE_SCHEMA,
  HUMMOD_ARDS_CORE,
  HUMMOD_ARDS_CORE_PHASE1_POLICY,
  HUMMOD_V13_FIDELITY_ROOT_STRUCTURES,
  HUMMOD_V13_FIDELITY_POLICY,
  hummodArdsCoreRootSymbols,
  hummodArdsCoreRootStructures,
};
