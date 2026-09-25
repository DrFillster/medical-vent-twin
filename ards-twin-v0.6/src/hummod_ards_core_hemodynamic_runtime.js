'use strict';

// hummod_ards_core_hemodynamic_runtime.js
//
// Reduced-order acute cardiopulmonary circulation built from source-aligned
// HumMod vascular/pump primitives plus one explicit modeling reduction:
//
//   The full HumMod organ/splanchnic circulation is collapsed into a single
//   systemic arterial runoff + systemic venous reservoir.
//
// Everything else in this module uses the source pressure-volume / pump
// relationships already ported in hummod_ards_core_hemodynamics.js.
//
// This is an engineering/research model, NOT a literal standalone HumMod
// extraction and NOT clinically validated.

const {
  VASCULAR_DEFAULTS,
  stressedVolumePressure,
  conductanceFlow,
  pericardialPressure,
  ventricularPump,
} = require('./hummod_ards_core_hemodynamics.js');

const HUMMOD_REDUCED_HEMODYNAMIC_SCHEMA =
  'hummod-ards-core-hemodynamics/v1';

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

function validateInitialState(state) {
  if (!state || typeof state !== 'object') {
    throw new Error('hemodynamic initialState is required');
  }
  for (const key of [
    'systemicArterialVolumeMl',
    'systemicVenousVolumeMl',
    'rightAtrialVolumeMl',
    'pulmonaryArterialVolumeMl',
    'pulmonaryCapillaryVolumeMl',
    'pulmonaryVenousVolumeMl',
    'leftAtrialVolumeMl',
  ]) nonNegative(state[key], 'initialState.' + key);
  return state;
}

function validateBoundary(boundary) {
  if (!boundary || typeof boundary !== 'object') {
    throw new Error('hemodynamic boundary is required');
  }
  positive(boundary.heartRatePerMin, 'heartRatePerMin');
  positive(boundary.rightContractilityMultiplier,
    'rightContractilityMultiplier');
  positive(boundary.leftContractilityMultiplier,
    'leftContractilityMultiplier');
  positive(boundary.rightStiffnessMultiplier,
    'rightStiffnessMultiplier');
  positive(boundary.leftStiffnessMultiplier,
    'leftStiffnessMultiplier');
  finite(boundary.thoracicPressureMmHg, 'thoracicPressureMmHg');
  finite(boundary.pericardialTmpMmHg, 'pericardialTmpMmHg');

  positive(boundary.systemicVenousV0Ml, 'systemicVenousV0Ml');
  positive(boundary.systemicVenousComplianceMlPerMmHg,
    'systemicVenousComplianceMlPerMmHg');
  nonNegative(boundary.venousReturnConductanceMlPerMinPerMmHg,
    'venousReturnConductanceMlPerMinPerMmHg');
  nonNegative(boundary.systemicRunoffConductanceMlPerMinPerMmHg,
    'systemicRunoffConductanceMlPerMinPerMmHg');

  return boundary;
}

function clampFlowNonNegative(value) {
  return Math.max(0, value);
}

function createHumModArdsHemodynamicRuntime({
  initialState,
  boundary,
} = {}) {
  let state = Object.freeze({ ...validateInitialState(initialState) });
  let currentBoundary = validateBoundary(boundary);
  let timeSec = 0;
  let last = null;

  function calculate(s, b) {
    const thorax = b.thoracicPressureMmHg;
    const pericardial = pericardialPressure({
      thoracicPressureMmHg: thorax,
      pericardialTmpMmHg: b.pericardialTmpMmHg,
    });

    const sysArt = stressedVolumePressure({
      volumeMl: s.systemicArterialVolumeMl,
      v0Ml: VASCULAR_DEFAULTS.systemicArteries.v0Ml,
      complianceMlPerMmHg:
        VASCULAR_DEFAULTS.systemicArteries.complianceMlPerMmHg,
      externalPressureMmHg: 0,
      clampStressedVolumeAtZero: true,
    });

    const sysVein = stressedVolumePressure({
      volumeMl: s.systemicVenousVolumeMl,
      v0Ml: b.systemicVenousV0Ml,
      complianceMlPerMmHg:
        b.systemicVenousComplianceMlPerMmHg,
      externalPressureMmHg: 0,
      clampStressedVolumeAtZero: true,
    });

    const ra = stressedVolumePressure({
      volumeMl: s.rightAtrialVolumeMl,
      v0Ml: VASCULAR_DEFAULTS.rightAtrium.v0Ml,
      complianceMlPerMmHg:
        VASCULAR_DEFAULTS.rightAtrium.complianceMlPerMmHg,
      externalPressureMmHg: pericardial,
      clampStressedVolumeAtZero: false,
    });

    const pa = stressedVolumePressure({
      volumeMl: s.pulmonaryArterialVolumeMl,
      v0Ml: VASCULAR_DEFAULTS.pulmonaryArtery.v0Ml,
      complianceMlPerMmHg:
        VASCULAR_DEFAULTS.pulmonaryArtery.complianceMlPerMmHg,
      externalPressureMmHg: thorax,
      clampStressedVolumeAtZero: true,
    });

    const pc = stressedVolumePressure({
      volumeMl: s.pulmonaryCapillaryVolumeMl,
      v0Ml: VASCULAR_DEFAULTS.pulmonaryCapillaries.v0Ml,
      complianceMlPerMmHg:
        VASCULAR_DEFAULTS.pulmonaryCapillaries.complianceMlPerMmHg,
      externalPressureMmHg: thorax,
      clampStressedVolumeAtZero: true,
    });

    const pv = stressedVolumePressure({
      volumeMl: s.pulmonaryVenousVolumeMl,
      v0Ml: VASCULAR_DEFAULTS.pulmonaryVeins.v0Ml,
      complianceMlPerMmHg:
        VASCULAR_DEFAULTS.pulmonaryVeins.complianceMlPerMmHg,
      externalPressureMmHg: thorax,
      clampStressedVolumeAtZero: true,
    });

    const la = stressedVolumePressure({
      volumeMl: s.leftAtrialVolumeMl,
      v0Ml: VASCULAR_DEFAULTS.leftAtrium.v0Ml,
      complianceMlPerMmHg:
        VASCULAR_DEFAULTS.leftAtrium.complianceMlPerMmHg,
      externalPressureMmHg: pericardial,
      clampStressedVolumeAtZero: false,
    });

    const venousReturn = clampFlowNonNegative(conductanceFlow({
      conductanceMlPerMinPerMmHg:
        b.venousReturnConductanceMlPerMinPerMmHg,
      upstreamPressureMmHg: sysVein.pressureMmHg,
      downstreamPressureMmHg: ra.pressureMmHg,
    }));

    const pulmonaryArteryFlow = clampFlowNonNegative(conductanceFlow({
      conductanceMlPerMinPerMmHg:
        VASCULAR_DEFAULTS.pulmonaryArtery
          .conductanceMlPerMinPerMmHg,
      upstreamPressureMmHg: pa.pressureMmHg,
      downstreamPressureMmHg: pc.pressureMmHg,
    }));

    const pulmonaryCapillaryFlow = clampFlowNonNegative(conductanceFlow({
      conductanceMlPerMinPerMmHg:
        VASCULAR_DEFAULTS.pulmonaryCapillaries
          .conductanceMlPerMinPerMmHg,
      upstreamPressureMmHg: pc.pressureMmHg,
      downstreamPressureMmHg: pv.pressureMmHg,
    }));

    const pulmonaryVenousFlow = clampFlowNonNegative(conductanceFlow({
      conductanceMlPerMinPerMmHg:
        VASCULAR_DEFAULTS.pulmonaryVeins
          .conductanceMlPerMinPerMmHg,
      upstreamPressureMmHg: pv.pressureMmHg,
      downstreamPressureMmHg: la.pressureMmHg,
    }));

    const systemicRunoff = clampFlowNonNegative(conductanceFlow({
      conductanceMlPerMinPerMmHg:
        b.systemicRunoffConductanceMlPerMinPerMmHg,
      upstreamPressureMmHg: sysArt.pressureMmHg,
      downstreamPressureMmHg: sysVein.pressureMmHg,
    }));

    const rightPump = ventricularPump({
      side: 'right',
      atrialPressureMmHg: ra.pressureMmHg,
      arterialPressureMmHg: pa.pressureMmHg,
      pericardialPressureMmHg: pericardial,
      heartRatePerMin: b.heartRatePerMin,
      contractilityMultiplier: b.rightContractilityMultiplier,
      stiffnessMultiplier: b.rightStiffnessMultiplier,
    });

    const leftPump = ventricularPump({
      side: 'left',
      atrialPressureMmHg: la.pressureMmHg,
      arterialPressureMmHg: sysArt.pressureMmHg,
      pericardialPressureMmHg: pericardial,
      heartRatePerMin: b.heartRatePerMin,
      contractilityMultiplier: b.leftContractilityMultiplier,
      stiffnessMultiplier: b.leftStiffnessMultiplier,
    });

    const rightPumpFlow =
      clampFlowNonNegative(rightPump.bloodFlowMlPerMin);
    const leftPumpFlow =
      clampFlowNonNegative(leftPump.bloodFlowMlPerMin);

    return Object.freeze({
      pressuresMmHg: Object.freeze({
        systemicArtery: sysArt.pressureMmHg,
        systemicVein: sysVein.pressureMmHg,
        rightAtrium: ra.pressureMmHg,
        pulmonaryArtery: pa.pressureMmHg,
        pulmonaryCapillary: pc.pressureMmHg,
        pulmonaryVein: pv.pressureMmHg,
        leftAtrium: la.pressureMmHg,
        thoracic: thorax,
        pericardial,
      }),
      flowsMlPerMin: Object.freeze({
        systemicRunoff,
        venousReturn,
        rightPump: rightPumpFlow,
        pulmonaryArtery: pulmonaryArteryFlow,
        pulmonaryCapillary: pulmonaryCapillaryFlow,
        pulmonaryVein: pulmonaryVenousFlow,
        leftPump: leftPumpFlow,
      }),
      pump: Object.freeze({
        right: rightPump,
        left: leftPump,
      }),
    });
  }

  function snapshot() {
    const calculated = calculate(state, currentBoundary);
    return Object.freeze({
      schema: HUMMOD_REDUCED_HEMODYNAMIC_SCHEMA,
      timeSec,
      state,
      boundary: currentBoundary,
      calculated,
      provenance: Object.freeze({
        status:
          'reduced-order-adaptation-using-source-aligned-HumMod-vascular-and-pump-equations',
        fullHumModEquivalent: false,
        systemicReduction:
          'organ-and-splanchnic-circulation-collapsed-to-systemic-runoff-and-venous-reservoir',
        clinicalValidation: false,
        pressureUnits: 'mmHg-HumMod-native',
        flowUnits: 'mL/min-HumMod-native',
      }),
    });
  }

  function step({ dtSec, boundary: nextBoundary } = {}) {
    positive(dtSec, 'dtSec');
    if (nextBoundary) currentBoundary = validateBoundary(nextBoundary);

    const c = calculate(state, currentBoundary);
    const f = c.flowsMlPerMin;
    const dtMin = dtSec / 60;

    const next = {
      systemicArterialVolumeMl:
        state.systemicArterialVolumeMl +
        dtMin * (f.leftPump - f.systemicRunoff),

      systemicVenousVolumeMl:
        state.systemicVenousVolumeMl +
        dtMin * (f.systemicRunoff - f.venousReturn),

      rightAtrialVolumeMl:
        state.rightAtrialVolumeMl +
        dtMin * (f.venousReturn - f.rightPump),

      pulmonaryArterialVolumeMl:
        state.pulmonaryArterialVolumeMl +
        dtMin * (f.rightPump - f.pulmonaryArtery),

      pulmonaryCapillaryVolumeMl:
        state.pulmonaryCapillaryVolumeMl +
        dtMin * (f.pulmonaryArtery - f.pulmonaryCapillary),

      pulmonaryVenousVolumeMl:
        state.pulmonaryVenousVolumeMl +
        dtMin * (f.pulmonaryCapillary - f.pulmonaryVein),

      leftAtrialVolumeMl:
        state.leftAtrialVolumeMl +
        dtMin * (f.pulmonaryVein - f.leftPump),
    };

    for (const [key, value] of Object.entries(next)) {
      if (!Number.isFinite(value) || value < 0) {
        throw new Error(
          'hemodynamic volume became non-physical: ' + key + '=' + value);
      }
    }

    state = Object.freeze(next);
    timeSec += dtSec;
    last = c;
    return snapshot();
  }

  return Object.freeze({
    kind: 'hummod-ards-core-hemodynamic-runtime',
    snapshot,
    step,
    setBoundary(nextBoundary) {
      currentBoundary = validateBoundary(nextBoundary);
      return snapshot();
    },
  });
}

module.exports = {
  HUMMOD_REDUCED_HEMODYNAMIC_SCHEMA,
  validateInitialState,
  validateBoundary,
  createHumModArdsHemodynamicRuntime,
};
