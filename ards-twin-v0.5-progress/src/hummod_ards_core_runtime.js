'use strict';

// hummod_ards_core_runtime.js
//
// First runnable reduced HumMod-ARDS gas/acid-base core.
//
// This runtime preserves source-aligned HumMod equations for:
// - Bronchi gas conditioning
// - BTPS -> STPD ventilation conversion
// - Lung O2 uptake / Lung CO2 expiration implicit balances
// - Arterial/venous O2 and HCO3 first-order delays
// - Blood CO2/HCO3/pH conversion
// - Hemoglobin P50 / saturation response
//
// Phase-1 explicit boundaries:
// - tissue O2 use
// - tissue CO2 production
// - cardiac output
// - ventilated pulmonary blood flow
// - dead space
// - membrane permeability
// - SID
// - O2 carrying capacity
//
// This is an engineering/research model and is not clinical validation.

const {
  HUMMOD_SOURCE_CLOCK,
} = require('./hummod_runner_contract.js');
const {
  pco2FromHco3Sid,
  phFromPco2Sid,
  hemoglobinProperties,
  saturationFractionFromPo2,
} = require('./hummod_ards_core_chemistry.js');
const {
  bronchiGasFractions,
  breathingFromVent,
} = require('./hummod_ards_core_breathing.js');
const {
  CO2_LITERS_TO_MOLS,
  o2ContentFromPo2,
  po2FromO2Content,
  solveOxygenExchange,
  solveCo2Exchange,
} = require('./hummod_ards_core_gas_exchange.js');

const HUMMOD_GAS_DELAY_K_PER_MIN = 5.0;

// Lower bound for the reduced aerobic-extraction model. Peripheral oxygen
// delivery literature describes a critical capillary PO2 on the order of
// 15-20 mmHg below which aerobic ATP production becomes supply limited.
// We use the lower bound (15 mmHg) as an explicit, conservative transition
// point. This is not an SvO2 target and does not prevent pathologically low
// venous saturation; it prevents the model from extracting more oxygen than
// can be represented by a positive venous PO2.
const CRITICAL_VENOUS_PO2_MMHG = 15;

const HUMMOD_SOURCE_INITIAL_GAS_STATE = Object.freeze({
  arterialO2ContentMlPerMl: 0.196,
  venousO2ContentMlPerMl: 0.157,
  arterialHco3MolPerL: 0.0240,
  venousHco3MolPerL: 0.0256,
  provenance: Object.freeze({
    arterialO2: 'Structure/O2/O2Artys.DES initialval',
    venousO2: 'Structure/O2/O2Veins.DES initialval',
    arterialHco3: 'Structure/CO2/CO2Artys.DES initialval',
    venousHco3: 'Structure/CO2/CO2Veins.DES initialval',
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

function fraction(value, label) {
  finite(value, label);
  if (value < 0 || value > 1) throw new Error(label + ' must be in [0,1]');
  return value;
}

function validateState(state) {
  if (!state || typeof state !== 'object') {
    throw new Error('initial gas state is required');
  }
  nonNegative(state.arterialO2ContentMlPerMl, 'arterialO2ContentMlPerMl');
  nonNegative(state.venousO2ContentMlPerMl, 'venousO2ContentMlPerMl');
  nonNegative(state.arterialHco3MolPerL, 'arterialHco3MolPerL');
  nonNegative(state.venousHco3MolPerL, 'venousHco3MolPerL');
  return state;
}

function firstOrderDelayExact({
  output,
  input,
  rateConstantPerMin,
  dtSec,
} = {}) {
  finite(output, 'output');
  finite(input, 'input');
  nonNegative(rateConstantPerMin, 'rateConstantPerMin');
  nonNegative(dtSec, 'dtSec');

  if (dtSec === 0 || rateConstantPerMin === 0) return output;

  const dtMinutes = dtSec / HUMMOD_SOURCE_CLOCK.secondsPerUnit;
  const alpha = 1 - Math.exp(-rateConstantPerMin * dtMinutes);
  return output + (alpha * (input - output));
}

function deriveBloodGasOutputs({
  state,
  blood,
} = {}) {
  validateState(state);
  positive(blood.sidMolPerL, 'blood.sidMolPerL');
  positive(blood.o2MaxMlPerMl, 'blood.o2MaxMlPerMl');
  finite(blood.tempC, 'blood.tempC');
  nonNegative(blood.carboxyPercent || 0, 'blood.carboxyPercent');

  const sidMeqPerL = 1000 * blood.sidMolPerL;

  const arterialPco2 = pco2FromHco3Sid({
    hco3MolPerL: state.arterialHco3MolPerL,
    sidMolPerL: blood.sidMolPerL,
  }).pco2MmHg;

  const arterialPh = phFromPco2Sid({
    pco2MmHg: arterialPco2,
    sid: sidMeqPerL,
  }).pH;

  const arterialHgb = hemoglobinProperties({
    tempC: blood.tempC,
    pH: arterialPh,
    pco2MmHg: arterialPco2,
    carboxyPercent: blood.carboxyPercent || 0,
  });

  const arterialPo2 = po2FromO2Content({
    o2ContentMlPerMl: state.arterialO2ContentMlPerMl,
    o2MaxMlPerMl: blood.o2MaxMlPerMl,
    p50MmHg: arterialHgb.p50MmHg,
    scaleForSat: arterialHgb.scaleForSat,
  });

  const arterialSat = saturationFractionFromPo2({
    po2MmHg: arterialPo2,
    p50MmHg: arterialHgb.p50MmHg,
    scaleForSat: arterialHgb.scaleForSat,
  });

  const venousPco2 = pco2FromHco3Sid({
    hco3MolPerL: state.venousHco3MolPerL,
    sidMolPerL: blood.sidMolPerL,
  }).pco2MmHg;

  const venousPh = phFromPco2Sid({
    pco2MmHg: venousPco2,
    sid: sidMeqPerL,
  }).pH;

  const venousHgb = hemoglobinProperties({
    tempC: blood.tempC,
    pH: venousPh,
    pco2MmHg: venousPco2,
    carboxyPercent: blood.carboxyPercent || 0,
  });

  const venousPo2 = po2FromO2Content({
    o2ContentMlPerMl: state.venousO2ContentMlPerMl,
    o2MaxMlPerMl: blood.o2MaxMlPerMl,
    p50MmHg: venousHgb.p50MmHg,
    scaleForSat: venousHgb.scaleForSat,
  });

  const venousSat = saturationFractionFromPo2({
    po2MmHg: venousPo2,
    p50MmHg: venousHgb.p50MmHg,
    scaleForSat: venousHgb.scaleForSat,
  });

  return Object.freeze({
    arterial: Object.freeze({
      po2MmHg: arterialPo2,
      pco2MmHg: arterialPco2,
      pH: arterialPh,
      saturationFraction: arterialSat,
      hco3MolPerL: state.arterialHco3MolPerL,
      o2ContentMlPerMl: state.arterialO2ContentMlPerMl,
      p50MmHg: arterialHgb.p50MmHg,
    }),
    venous: Object.freeze({
      po2MmHg: venousPo2,
      pco2MmHg: venousPco2,
      pH: venousPh,
      saturationFraction: venousSat,
      hco3MolPerL: state.venousHco3MolPerL,
      o2ContentMlPerMl: state.venousO2ContentMlPerMl,
      p50MmHg: venousHgb.p50MmHg,
    }),
  });
}

function validateBoundary(boundary) {
  if (!boundary || typeof boundary !== 'object') {
    throw new Error('ARDS core boundary is required');
  }

  const v = boundary.ventilation;
  const p = boundary.pulmonary;
  const c = boundary.circulation;
  const m = boundary.metabolism;
  const b = boundary.blood;
  const e = boundary.environment;

  if (!v || !p || !c || !m || !b || !e) {
    throw new Error(
      'boundary requires ventilation, pulmonary, circulation, metabolism, blood and environment');
  }

  positive(v.respiratoryRatePerMin, 'ventilation.respiratoryRatePerMin');
  positive(v.tidalVolumeBtpsMl, 'ventilation.tidalVolumeBtpsMl');
  nonNegative(v.deadSpaceBtpsMl, 'ventilation.deadSpaceBtpsMl');
  fraction(v.fio2, 'ventilation.fio2');

  positive(p.membranePermeabilityMlPerMinPerMmHg,
    'pulmonary.membranePermeabilityMlPerMinPerMmHg');
  nonNegative(p.ventilatedPulmonaryBloodFlowMlPerMin,
    'pulmonary.ventilatedPulmonaryBloodFlowMlPerMin');

  positive(c.cardiacOutputMlPerMin, 'circulation.cardiacOutputMlPerMin');
  if (p.ventilatedPulmonaryBloodFlowMlPerMin > c.cardiacOutputMlPerMin) {
    throw new Error('ventilated pulmonary blood flow cannot exceed cardiac output');
  }

  nonNegative(m.tissueO2UseMlPerMin, 'metabolism.tissueO2UseMlPerMin');
  nonNegative(m.tissueCo2ProductionMmolPerMin,
    'metabolism.tissueCo2ProductionMmolPerMin');

  positive(b.sidMolPerL, 'blood.sidMolPerL');
  positive(b.o2MaxMlPerMl, 'blood.o2MaxMlPerMl');
  finite(b.tempC, 'blood.tempC');
  nonNegative(b.carboxyPercent || 0, 'blood.carboxyPercent');

  positive(e.barometricPressureMmHg, 'environment.barometricPressureMmHg');
  fraction(e.inspiredCo2Fraction || 0, 'environment.inspiredCo2Fraction');

  return boundary;
}

function createHumModArdsGasRuntime({
  initialState,
  useHumModSourceInitialState = false,
  boundary,
} = {}) {
  if (initialState && useHumModSourceInitialState) {
    throw new Error('choose initialState or useHumModSourceInitialState, not both');
  }

  let state = validateState(
    initialState ||
    (useHumModSourceInitialState
      ? HUMMOD_SOURCE_INITIAL_GAS_STATE
      : null)
  );

  let currentBoundary = validateBoundary(boundary);
  let timeSec = 0;
  let lastExchange = null;

  function snapshot() {
    const gases = deriveBloodGasOutputs({
      state,
      blood: currentBoundary.blood,
    });

    return Object.freeze({
      schema: 'hummod-ards-core-gas-runtime/v1',
      timeSec,
      state: Object.freeze({ ...state }),
      gases,
      exchange: lastExchange,
      boundary: currentBoundary,
      provenance: Object.freeze({
        status: 'source-aligned-reduced-order-research-model',
        humModRevision: '8dab57e05631f779bf5020fe0dd51874d8ae98c1',
        delayEquation: 'dOutput/dt = K * (Input - Output)',
        delayRateConstantPerMin: HUMMOD_GAS_DELAY_K_PER_MIN,
        delayNumerics: 'analytic-first-order-update-in-JS',
        systemicHemodynamics: 'not-yet-coupled-in-this-runtime',
        clinicalValidation: false,
      }),
    });
  }

  function step({
    dtSec,
    boundary: nextBoundary,
  } = {}) {
    positive(dtSec, 'dtSec');
    if (nextBoundary) currentBoundary = validateBoundary(nextBoundary);

    const v = currentBoundary.ventilation;
    const p = currentBoundary.pulmonary;
    const c = currentBoundary.circulation;
    const m = currentBoundary.metabolism;
    const b = currentBoundary.blood;
    const e = currentBoundary.environment;

    const currentGases = deriveBloodGasOutputs({
      state,
      blood: b,
    });

    const bronchi = bronchiGasFractions({
      inspiredPressureMmHg: e.barometricPressureMmHg,
      inspiredO2Fraction: v.fio2,
      inspiredCo2Fraction: e.inspiredCo2Fraction || 0,
    });

    const breathing = breathingFromVent({
      respiratoryRatePerMin: v.respiratoryRatePerMin,
      tidalVolumeBtpsMl: v.tidalVolumeBtpsMl,
      deadSpaceBtpsMl: v.deadSpaceBtpsMl,
      inspiredPressureMmHg: e.barometricPressureMmHg,
      bodyTempC: b.tempC,
    });

    const oxygen = solveOxygenExchange({
      alveolarVentilationStpdMlPerMin:
        breathing.alveolarVentilationStpdMlPerMin,
      bronchiO2Fraction: bronchi.o2Fraction,
      barometricPressureMmHg: e.barometricPressureMmHg,
      pulmonaryMembranePermeabilityMlPerMinPerMmHg:
        p.membranePermeabilityMlPerMinPerMmHg,
      ventilatedPulmonaryBloodFlowMlPerMin:
        p.ventilatedPulmonaryBloodFlowMlPerMin,
      mixedVenousO2ContentMlPerMl:
        state.venousO2ContentMlPerMl,
      o2MaxMlPerMl: b.o2MaxMlPerMl,
      tempC: b.tempC,
      arterialPhEstimate: currentGases.arterial.pH,
      arterialPco2EstimateMmHg: currentGases.arterial.pco2MmHg,
      carboxyPercent: b.carboxyPercent || 0,
    });

    const carbonDioxide = solveCo2Exchange({
      alveolarVentilationStpdMlPerMin:
        breathing.alveolarVentilationStpdMlPerMin,
      bronchiCo2Fraction: bronchi.co2Fraction,
      barometricPressureMmHg: e.barometricPressureMmHg,
      ventilatedPulmonaryBloodFlowMlPerMin:
        p.ventilatedPulmonaryBloodFlowMlPerMin,
      mixedVenousHco3MolPerL:
        state.venousHco3MolPerL,
      sidMolPerL: b.sidMolPerL,
    });

    const co = c.cardiacOutputMlPerMin;

    const arterialO2Target =
      state.venousO2ContentMlPerMl +
      (oxygen.uptakeMlPerMin / co);

    const venousHgbForExtraction = hemoglobinProperties({
      tempC: b.tempC,
      pH: currentGases.venous.pH,
      pco2MmHg: currentGases.venous.pco2MmHg,
      carboxyPercent: b.carboxyPercent || 0,
    });
    const criticalVenousO2ContentMlPerMl = o2ContentFromPo2({
      po2MmHg: CRITICAL_VENOUS_PO2_MMHG,
      o2MaxMlPerMl: b.o2MaxMlPerMl,
      p50MmHg: venousHgbForExtraction.p50MmHg,
      scaleForSat: venousHgbForExtraction.scaleForSat,
    });
    const requestedTissueO2UseMlPerMin = m.tissueO2UseMlPerMin;
    const maxAerobicO2UseMlPerMin = Math.max(
      0,
      co * Math.max(
        0,
        state.arterialO2ContentMlPerMl - criticalVenousO2ContentMlPerMl));
    const actualTissueO2UseMlPerMin = Math.min(
      requestedTissueO2UseMlPerMin,
      maxAerobicO2UseMlPerMin);
    const oxygenSupplyDeficitMlPerMin = Math.max(
      0,
      requestedTissueO2UseMlPerMin - actualTissueO2UseMlPerMin);
    const venousO2Target = Math.max(
      criticalVenousO2ContentMlPerMl,
      state.arterialO2ContentMlPerMl -
        (actualTissueO2UseMlPerMin / co));

    const lungCo2OutflowMmolPerMin =
      carbonDioxide.expiredCo2MlPerMin * CO2_LITERS_TO_MOLS;

    const arterialHco3Target =
      state.venousHco3MolPerL -
      (lungCo2OutflowMmolPerMin / co);

    const venousHco3Target =
      state.arterialHco3MolPerL +
      (m.tissueCo2ProductionMmolPerMin / co);

    for (const [name, value] of Object.entries({
      arterialO2Target,
      venousO2Target,
      arterialHco3Target,
      venousHco3Target,
    })) {
      if (!Number.isFinite(value) || value < 0) {
        throw new Error(name + ' became non-physical under supplied boundaries');
      }
    }

    state = Object.freeze({
      arterialO2ContentMlPerMl: firstOrderDelayExact({
        output: state.arterialO2ContentMlPerMl,
        input: arterialO2Target,
        rateConstantPerMin: HUMMOD_GAS_DELAY_K_PER_MIN,
        dtSec,
      }),
      venousO2ContentMlPerMl: firstOrderDelayExact({
        output: state.venousO2ContentMlPerMl,
        input: venousO2Target,
        rateConstantPerMin: HUMMOD_GAS_DELAY_K_PER_MIN,
        dtSec,
      }),
      arterialHco3MolPerL: firstOrderDelayExact({
        output: state.arterialHco3MolPerL,
        input: arterialHco3Target,
        rateConstantPerMin: HUMMOD_GAS_DELAY_K_PER_MIN,
        dtSec,
      }),
      venousHco3MolPerL: firstOrderDelayExact({
        output: state.venousHco3MolPerL,
        input: venousHco3Target,
        rateConstantPerMin: HUMMOD_GAS_DELAY_K_PER_MIN,
        dtSec,
      }),
    });

    timeSec += dtSec;
    lastExchange = Object.freeze({
      breathing,
      bronchi,
      oxygen,
      carbonDioxide,
      massBalance: Object.freeze({
        requestedTissueO2UseMlPerMin,
        actualTissueO2UseMlPerMin,
        oxygenSupplyDeficitMlPerMin,
        criticalVenousPo2MmHg: CRITICAL_VENOUS_PO2_MMHG,
        criticalVenousO2ContentMlPerMl,
        lungO2UptakeMlPerMin: oxygen.uptakeMlPerMin,
        tissueCo2ProductionMmolPerMin:
          m.tissueCo2ProductionMmolPerMin,
        lungCo2OutflowMmolPerMin,
      }),
      targets: Object.freeze({
        arterialO2ContentMlPerMl: arterialO2Target,
        venousO2ContentMlPerMl: venousO2Target,
        arterialHco3MolPerL: arterialHco3Target,
        venousHco3MolPerL: venousHco3Target,
      }),
    });

    return snapshot();
  }

  return Object.freeze({
    kind: 'hummod-ards-core-gas-runtime',
    snapshot,
    step,
    setBoundary(nextBoundary) {
      currentBoundary = validateBoundary(nextBoundary);
      return snapshot();
    },
  });
}

module.exports = {
  HUMMOD_GAS_DELAY_K_PER_MIN,
  HUMMOD_SOURCE_INITIAL_GAS_STATE,
  CRITICAL_VENOUS_PO2_MMHG,
  firstOrderDelayExact,
  deriveBloodGasOutputs,
  validateBoundary,
  createHumModArdsGasRuntime,
};
