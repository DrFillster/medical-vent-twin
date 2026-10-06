'use strict';

// hummod_ards_core_combined_runtime.js
//
// First composed reduced HumMod-ARDS-Core runtime.
//
// Couples:
//   reduced source-aligned cardiopulmonary circulation
//     -> dynamic cardiac output / pulmonary blood flow
//   source-aligned acute gas + acid-base runtime
//
// Still explicit:
// - ventilated fraction of pulmonary perfusion
// - Vent -> thoracic pressure (mmHg) adapter
// - pulmonary membrane permeability
// - tissue VO2/VCO2
// - SID / O2 carrying capacity
//
// Numerical coupling uses sequential operator splitting at each reduced-core
// step: hemodynamics first, then gas/acid-base using the updated flows.

const {
  createHumModArdsHemodynamicRuntime,
} = require('./hummod_ards_core_hemodynamic_runtime.js');
const {
  createHumModArdsGasRuntime,
} = require('./hummod_ards_core_runtime.js');

const HUMMOD_ARDS_COMBINED_SCHEMA =
  'hummod-ards-core-combined/v1';

function finite(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(label + ' must be finite');
  }
  return value;
}

function fraction(value, label) {
  finite(value, label);
  if (value < 0 || value > 1) {
    throw new Error(label + ' must be in [0,1]');
  }
  return value;
}

function buildDynamicGasBoundary({
  gasBoundaryTemplate,
  hemodynamicSnapshot,
  ventilatedPerfusionFraction,
} = {}) {
  if (!gasBoundaryTemplate || typeof gasBoundaryTemplate !== 'object') {
    throw new Error('gasBoundaryTemplate is required');
  }
  if (!hemodynamicSnapshot || !hemodynamicSnapshot.calculated) {
    throw new Error('hemodynamicSnapshot is required');
  }
  fraction(ventilatedPerfusionFraction, 'ventilatedPerfusionFraction');

  const f = hemodynamicSnapshot.calculated.flowsMlPerMin;

  const cardiacOutputMlPerMin = f.leftPump;
  const totalPulmonaryBloodFlowMlPerMin =
    (f.pulmonaryArtery + f.pulmonaryCapillary) / 2;

  if (!(cardiacOutputMlPerMin > 0)) {
    throw new Error(
      'dynamic left-pump cardiac output must be > 0 for gas exchange');
  }
  if (!(totalPulmonaryBloodFlowMlPerMin > 0)) {
    throw new Error(
      'dynamic pulmonary blood flow must be > 0 for gas exchange');
  }

  const ventilatedPulmonaryBloodFlowMlPerMin =
    totalPulmonaryBloodFlowMlPerMin *
    ventilatedPerfusionFraction;

  return Object.freeze({
    ventilation: Object.freeze({
      ...gasBoundaryTemplate.ventilation,
    }),
    pulmonary: Object.freeze({
      ...gasBoundaryTemplate.pulmonary,
      ventilatedPulmonaryBloodFlowMlPerMin,
    }),
    circulation: Object.freeze({
      cardiacOutputMlPerMin,
    }),
    metabolism: Object.freeze({
      ...gasBoundaryTemplate.metabolism,
    }),
    blood: Object.freeze({
      ...gasBoundaryTemplate.blood,
    }),
    environment: Object.freeze({
      ...gasBoundaryTemplate.environment,
    }),
  });
}

function createHumModArdsCombinedRuntime({
  gasInitialState,
  useHumModSourceInitialGasState = false,
  hemodynamicInitialState,
  hemodynamicBoundary,
  gasBoundaryTemplate,
  ventilatedPerfusionFraction,
} = {}) {
  let perfusionFraction = fraction(
    ventilatedPerfusionFraction,
    'ventilatedPerfusionFraction'
  );

  let hemodynamicRuntime = createHumModArdsHemodynamicRuntime({
    initialState: hemodynamicInitialState,
    boundary: hemodynamicBoundary,
  });

  let hemoSnapshot = hemodynamicRuntime.snapshot();
  let dynamicGasBoundary = buildDynamicGasBoundary({
    gasBoundaryTemplate,
    hemodynamicSnapshot: hemoSnapshot,
    ventilatedPerfusionFraction: perfusionFraction,
  });

  const gasRuntime = createHumModArdsGasRuntime({
    initialState: gasInitialState,
    useHumModSourceInitialState: useHumModSourceInitialGasState,
    boundary: dynamicGasBoundary,
  });

  let gasTemplate = gasBoundaryTemplate;
  let gasSnapshot = gasRuntime.snapshot();
  let timeSec = 0;

  function snapshot() {
    const f = hemoSnapshot.calculated.flowsMlPerMin;
    return Object.freeze({
      schema: HUMMOD_ARDS_COMBINED_SCHEMA,
      timeSec,
      hemodynamics: hemoSnapshot,
      gases: gasSnapshot,
      coupling: Object.freeze({
        cardiacOutputMlPerMin: f.leftPump,
        totalPulmonaryBloodFlowMlPerMin:
          (f.pulmonaryArtery + f.pulmonaryCapillary) / 2,
        ventilatedPerfusionFraction: perfusionFraction,
        ventilatedPulmonaryBloodFlowMlPerMin:
          dynamicGasBoundary.pulmonary
            .ventilatedPulmonaryBloodFlowMlPerMin,
        updateOrder: 'hemodynamics-then-gas',
      }),
      provenance: Object.freeze({
        status:
          'source-aligned-reduced-order-cardiopulmonary-core',
        fullHumModEquivalent: false,
        clinicalValidation: false,
        unresolvedVentPressureAdapter:
          'Vent cmH2O -> HumMod mmHg thoracic-pressure adapter not embedded here',
        unresolvedPerfusionMapping:
          'ventilatedPerfusionFraction is an explicit boundary',
      }),
    });
  }

  function step({
    dtSec,
    hemodynamicBoundary: nextHemodynamicBoundary,
    gasBoundaryTemplate: nextGasTemplate,
    ventilatedPerfusionFraction: nextPerfusionFraction,
  } = {}) {
    finite(dtSec, 'dtSec');
    if (!(dtSec > 0)) throw new Error('dtSec must be > 0');

    if (nextGasTemplate) gasTemplate = nextGasTemplate;
    if (nextPerfusionFraction != null) {
      perfusionFraction = fraction(
        nextPerfusionFraction,
        'ventilatedPerfusionFraction'
      );
    }

    hemoSnapshot = hemodynamicRuntime.step({
      dtSec,
      boundary: nextHemodynamicBoundary,
    });

    dynamicGasBoundary = buildDynamicGasBoundary({
      gasBoundaryTemplate: gasTemplate,
      hemodynamicSnapshot: hemoSnapshot,
      ventilatedPerfusionFraction: perfusionFraction,
    });

    gasSnapshot = gasRuntime.step({
      dtSec,
      boundary: dynamicGasBoundary,
    });

    timeSec += dtSec;
    return snapshot();
  }

  return Object.freeze({
    kind: 'hummod-ards-core-combined-runtime',
    snapshot,
    step,
  });
}

module.exports = {
  HUMMOD_ARDS_COMBINED_SCHEMA,
  buildDynamicGasBoundary,
  createHumModArdsCombinedRuntime,
};
