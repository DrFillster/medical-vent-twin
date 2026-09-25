'use strict';

// Experimental browser-capable coupling of persistent Vent mechanics to the
// reduced, source-aligned HumMod ARDS cardiopulmonary core.
// This is not full HumMod and is not clinically validated.

const { getBerlinCase } = require('./berlin_case_catalog.js');
const { makePatientParams } = require('./contracts.js');
const { Simulation, VcAcController } = require('./simulation.js');
const { summarizeSimulationMeasurements } = require('./bedside_measurements.js');
const { createThoraxState } = require('./hummod_ards_core_thorax.js');
const { createHumModArdsCirculation } = require('./hummod_ards_core_circulation.js');
const { createHumModArdsGasRuntime } = require('./hummod_ards_core_runtime.js');
const {
  createHumModArdsCardiopulmonaryRuntime,
  meanAirwayPressureCmH2O,
} = require('./hummod_ards_cardiopulmonary_runtime.js');
const { createLiveCoreBoundaryFromVent } = require('./hummod_ards_core_vent_adapter.js');
const { cmH2OToMmHg } = require('./clinical_units.js');

const LIVE_HUMMOD_REFERENCE_CASE_ID = 'berlin-moderate-moderate-aspiration';

const LIVE_HUMMOD_ENGINEERING_BOUNDARIES = Object.freeze({
  status: 'explicit-synthetic-engineering-boundaries-not-patient-data',
  thorax: Object.freeze({
    referencePleuralPressureCmH2O: 6,
    chestWallElastanceFraction: 0.25,
    pericardialTmpMmHg: 0,
    provenance: Object.freeze({
      kind: 'synthetic-engineering-assumption',
      note:
        'Reference-case phase-1 thorax values are explicit placeholders and are not inferred from Berlin severity or recruitability.',
    }),
  }),
  circulation: Object.freeze({
    initialVolumesMl: Object.freeze({
      systemicArteries: 999,
      systemicVeins: 2675,
      rightAtrium: 51,
      pulmonaryArtery: 201,
      pulmonaryCapillaries: 200,
      pulmonaryVeins: 211,
      leftAtrium: 51,
    }),
    boundaries: Object.freeze({
      heartRatePerMin: 75,
      systemicArterialConductanceMlPerMinPerMmHg: 60,
      systemicVenousConductanceMlPerMinPerMmHg: 692,
      rightContractilityMultiplier: 1,
      leftContractilityMultiplier: 1,
      rightStiffnessMultiplier: 1,
      leftStiffnessMultiplier: 1,
    }),
  }),
  gas: Object.freeze({
    systemic: Object.freeze({
      tissueO2UseMlPerMin: 250,
      tissueCo2ProductionMmolPerMin: 200 * 0.0446,
    }),
    pulmonary: Object.freeze({
      membranePermeabilityMlPerMinPerMmHg: 5.0 * 0.55 * 80.0 / 0.6,
      deadSpaceBtpsMl: null,
    }),
    blood: Object.freeze({
      sidMolPerL: 0.040,
      o2MaxMlPerMl: 1.34 * 0.15,
      tempC: 37,
      carboxyPercent: 0,
    }),
    environment: Object.freeze({
      barometricPressureMmHg: 760,
      inspiredCo2Fraction: 0,
    }),
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
  if (value < 0) throw new Error(label + ' must be non-negative');
  return value;
}
function fraction(value, label) {
  finite(value, label);
  if (value < 0 || value > 1) throw new Error(label + ' must be in [0,1]');
  return value;
}

function validateRecruitmentState(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('initialRecruitmentState is required');
  }
  ['normal', 'recruitable', 'consolidated'].forEach(key =>
    finite(value[key], 'initialRecruitmentState.' + key));
  if (value.normal !== 1) throw new Error('initialRecruitmentState.normal must be 1');
  if (value.consolidated !== 0) throw new Error('initialRecruitmentState.consolidated must be 0');
  if (value.recruitable < 0 || value.recruitable > 1) {
    throw new Error('initialRecruitmentState.recruitable must be in [0,1]');
  }
  return value;
}

function buildLiveController(ventilation) {
  if (!ventilation || typeof ventilation !== 'object' || Array.isArray(ventilation)) {
    throw new Error('ventilation settings are required');
  }
  if (ventilation.mode !== 'VC_AC') {
    throw new Error('live reduced HumMod core currently supports VC_AC only');
  }
  return new VcAcController({
    fio2: fraction(ventilation.fio2, 'ventilation.fio2'),
    peep: nonNegative(ventilation.peep, 'ventilation.peep'),
    rr: positive(ventilation.rr, 'ventilation.rr'),
    vt: positive(ventilation.vtL, 'ventilation.vtL'),
    inspiratoryFlow: positive(ventilation.inspiratoryFlowLps, 'ventilation.inspiratoryFlowLps'),
    inspiratoryPause: ventilation.inspiratoryPauseSec == null
      ? 0
      : nonNegative(ventilation.inspiratoryPauseSec, 'ventilation.inspiratoryPauseSec'),
  });
}

function createBerlinLiveHumModSession({
  caseId,
  ventilation,
  initialRecruitmentState,
  initializationHistory,
  dt = 0.002,
  mechanicalWarmupSec = 30,
  nativeCalibrationTarget = null,
} = {}) {
  if (caseId !== LIVE_HUMMOD_REFERENCE_CASE_ID) {
    throw new Error(
      'live reduced HumMod core is currently calibrated only for ' +
      LIVE_HUMMOD_REFERENCE_CASE_ID);
  }
  const clinicalCase = getBerlinCase(caseId);
  if (nativeCalibrationTarget &&
      nativeCalibrationTarget.schema !== 'vent-native-reduced-hummod-calibration-target/v1') {
    throw new Error('nativeCalibrationTarget has unsupported schema');
  }
  const nativeState = nativeCalibrationTarget &&
    nativeCalibrationTarget.nativeReducedState &&
    nativeCalibrationTarget.nativeReducedState.available
      ? nativeCalibrationTarget.nativeReducedState.initialState
      : null;
  const nativeHeartRate = nativeCalibrationTarget &&
    nativeCalibrationTarget.endpoints
      ? nativeCalibrationTarget.endpoints.heartRatePerMin
      : null;
  const nativeCirculationVolumes = nativeCalibrationTarget &&
    nativeCalibrationTarget.nativeCirculationState &&
    nativeCalibrationTarget.nativeCirculationState.available
      ? nativeCalibrationTarget.nativeCirculationState.initialVolumesMl
      : null;
  if (nativeHeartRate != null) positive(nativeHeartRate, 'nativeCalibrationTarget.endpoints.heartRatePerMin');
  const effectiveCirculationBoundaries = Object.freeze({
    ...LIVE_HUMMOD_ENGINEERING_BOUNDARIES.circulation.boundaries,
    heartRatePerMin: nativeHeartRate == null
      ? LIVE_HUMMOD_ENGINEERING_BOUNDARIES.circulation.boundaries.heartRatePerMin
      : nativeHeartRate,
  });
  if (initialRecruitmentState) validateRecruitmentState(initialRecruitmentState);
  else if (!initializationHistory) {
    throw new Error('initialRecruitmentState or initializationHistory is required');
  }
  positive(dt, 'dt');
  nonNegative(mechanicalWarmupSec, 'mechanicalWarmupSec');

  const controller = buildLiveController(ventilation);
  const params = makePatientParams(clinicalCase.phenotype.mechanicsParams);
  const simulation = new Simulation({
    params,
    controller,
    dt,
    trackGas: false,
    initialPEEP: ventilation.peep,
    initialRecruitmentState,
    initializationHistory,
  });

  if (mechanicalWarmupSec > 0) simulation.runFor(mechanicalWarmupSec);
  const ventTimeOriginSec = simulation.state.t;
  const referenceMeanAirwayPressureCmH2O = meanAirwayPressureCmH2O(simulation);

  const thorax = createThoraxState({
    referenceAirwayPressureCmH2O: referenceMeanAirwayPressureCmH2O,
    referencePleuralPressureCmH2O:
      LIVE_HUMMOD_ENGINEERING_BOUNDARIES.thorax.referencePleuralPressureCmH2O,
    chestWallElastanceFraction:
      LIVE_HUMMOD_ENGINEERING_BOUNDARIES.thorax.chestWallElastanceFraction,
    provenance: LIVE_HUMMOD_ENGINEERING_BOUNDARIES.thorax.provenance,
  });

  const circulation = createHumModArdsCirculation({
    initialVolumesMl: nativeCirculationVolumes ||
      LIVE_HUMMOD_ENGINEERING_BOUNDARIES.circulation.initialVolumesMl,
    boundaries: effectiveCirculationBoundaries,
    maxSubstepSec: 0.005,
  });

  const baselineThorax = thorax.atStaticAirwayPressure(referenceMeanAirwayPressureCmH2O);
  const baselineThoracicPressureMmHg = cmH2OToMmHg(baselineThorax.pleuralPressureCmH2O);
  const primedCirc = circulation.step({
    dtSec: 0.01,
    thoracicPressureMmHg: baselineThoracicPressureMmHg,
    pericardialPressureMmHg:
      baselineThoracicPressureMmHg +
      LIVE_HUMMOD_ENGINEERING_BOUNDARIES.thorax.pericardialTmpMmHg,
  });
  const initialCardiacOutputMlPerMin = primedCirc.flowsMlPerMin.leftVentricular;
  const initialGasBoundary = createLiveCoreBoundaryFromVent({
    simulation,
    systemic: {
      ...LIVE_HUMMOD_ENGINEERING_BOUNDARIES.gas.systemic,
      cardiacOutputMlPerMin: initialCardiacOutputMlPerMin,
    },
    pulmonary: LIVE_HUMMOD_ENGINEERING_BOUNDARIES.gas.pulmonary,
    blood: LIVE_HUMMOD_ENGINEERING_BOUNDARIES.gas.blood,
    environment: LIVE_HUMMOD_ENGINEERING_BOUNDARIES.gas.environment,
  });
  const gasRuntime = createHumModArdsGasRuntime({
    ...(nativeState
      ? { initialState: nativeState }
      : { useHumModSourceInitialState: true }),
    boundary: initialGasBoundary.boundary,
  });
  const systemicRuntime = createHumModArdsCardiopulmonaryRuntime({
    simulation,
    thorax,
    circulation,
    gasRuntime,
    pressureAdapter: { cmH2OToMmHg },
    systemicBoundaries: LIVE_HUMMOD_ENGINEERING_BOUNDARIES.gas.systemic,
    pulmonaryBoundaries: LIVE_HUMMOD_ENGINEERING_BOUNDARIES.gas.pulmonary,
    bloodBoundaries: LIVE_HUMMOD_ENGINEERING_BOUNDARIES.gas.blood,
    environmentBoundaries: LIVE_HUMMOD_ENGINEERING_BOUNDARIES.gas.environment,
    pericardialTmpMmHg:
      LIVE_HUMMOD_ENGINEERING_BOUNDARIES.thorax.pericardialTmpMmHg,
  });

  const sessionEvents = [];
  let initialized = false;
  let systemicSnapshot = systemicRuntime.snapshot();

  function currentVentSettings() {
    const s = simulation.controller.settings;
    return Object.freeze({
      mode: 'VC_AC',
      fio2: s.fio2,
      peepCmH2O: s.peep,
      rrPerMin: s.rr,
      vtL: s.vt,
      inspiratoryFlowLps: s.inspiratoryFlow,
      inspiratoryPauseSec: s.inspiratoryPause,
    });
  }

  function liveSystemicView() {
    const last = systemicSnapshot.lastStep;
    if (!last) {
      return Object.freeze({
        source: 'reduced-source-aligned-HumMod-ARDS-core',
        status: 'initialized-not-yet-stepped',
        gasExchange: null,
        hemodynamics: Object.freeze({
          heartRatePerMin:
            effectiveCirculationBoundaries.heartRatePerMin,
          meanArterialPressureMmHg: null,
        }),
      });
    }
    const circ = last.circulation;
    const gas = last.gas;
    const decomp = last.decompensation || null;
    const arrested = Boolean(decomp && decomp.cardiacArrest);
    return Object.freeze({
      source: 'reduced-source-aligned-HumMod-ARDS-core',
      status: 'live-coupled-experimental',
      gasExchange: Object.freeze({
        pao2MmHg: gas.gases.arterial.po2MmHg,
        paco2MmHg: gas.gases.arterial.pco2MmHg,
        pH: gas.gases.arterial.pH,
        sao2Fraction: gas.gases.arterial.saturationFraction,
        pvo2MmHg: gas.gases.venous.po2MmHg,
        svo2Fraction: gas.gases.venous.saturationFraction,
        requestedTissueO2UseMlPerMin:
          gas.exchange?.massBalance?.requestedTissueO2UseMlPerMin ?? null,
        actualTissueO2UseMlPerMin:
          gas.exchange?.massBalance?.actualTissueO2UseMlPerMin ?? null,
        oxygenSupplyDeficitMlPerMin:
          gas.exchange?.massBalance?.oxygenSupplyDeficitMlPerMin ?? null,
      }),
      hemodynamics: Object.freeze({
        heartRatePerMin: arrested
          ? 0
          : (circ.activeBoundaries?.heartRatePerMin ??
            effectiveCirculationBoundaries.heartRatePerMin),
        meanArterialPressureMmHg: circ.pressures.systemicArterialMmHg,
        rightAtrialPressureMmHg: circ.pressures.rightAtrialMmHg,
        pulmonaryArteryPressureMmHg: circ.pressures.pulmonaryArteryMmHg,
        cardiacOutputMlPerMin: arrested ? 0 : circ.flowsMlPerMin.leftVentricular,
        strokeVolumeMl: arrested ? 0 : (circ.leftVentricle?.strokeVolumeMl ?? null),
        systemicVascularResistanceMmHgMinPerL:
          circ.derivedResistance?.systemicVascularResistanceMmHgMinPerL ?? null,
        pulmonaryVascularResistanceMmHgMinPerL:
          circ.derivedResistance?.pulmonaryVascularResistanceMmHgMinPerL ?? null,
        contractilityMultiplier:
          last.effectiveContractilityMultiplier ??
          circ.activeBoundaries?.leftContractilityMultiplier ?? null,
        sympatheticTone: last.autonomic?.sympatheticTone ?? null,
        parasympatheticTone: last.autonomic?.parasympatheticTone ?? null,
        catecholamineDrive: last.autonomic?.catecholamineDrive ?? null,
      }),
      decompensation: decomp ? Object.freeze({
        stage: decomp.stage,
        alive: decomp.alive,
        cardiacArrest: decomp.cardiacArrest,
        oxygenDebtMl: decomp.oxygenDebtMl,
        equivalentDebtMinutes: decomp.equivalentDebtMinutes,
        metabolicFailureFraction: decomp.metabolicFailureFraction,
        myocardialContractilityMultiplier:
          decomp.myocardialContractilityMultiplier,
        lowMapBelow30Sec: decomp.lowMapBelow30Sec,
        lowMapBelow20Sec: decomp.lowMapBelow20Sec,
      }) : null,
      thorax: Object.freeze({
        meanAirwayPressureCmH2O: last.meanAirwayPressureCmH2O,
        pleuralPressureCmH2O: last.thorax.pleuralPressureCmH2O,
        transpulmonaryPressureCmH2O: last.thorax.transpulmonaryPressureCmH2O,
      }),
      coupling: Object.freeze({ ...last.adapterDiagnostics }),
    });
  }

  function snapshot() {
    const mechanics = summarizeSimulationMeasurements(simulation);
    const recentWaveform = Object.freeze(
      simulation.trace.slice(-2000).map(row => Object.freeze({
        t: row.t - ventTimeOriginSec,
        pressureCmH2O: row.output.airwayPressure,
        flowLps: row.output.airwayFlow,
        volumeL: row.output.totalVolume,
        phase: row.phase,
        maneuver: row.maneuver,
      }))
    );
    return Object.freeze({
      sessionSchema: 'berlin-clinical-twin-live-hummod-session/v1',
      timeSec: systemicSnapshot.timeSec,
      case: Object.freeze({
        id: clinicalCase.id,
        name: clinicalCase.name,
        berlinSeverity: clinicalCase.clinical.berlinSeverity,
        recruitability: clinicalCase.phenotype.recruitability,
        synthetic: clinicalCase.synthetic,
      }),
      ventilator: currentVentSettings(),
      ventilatorChangePending: Boolean(simulation.pendingControllerChange),
      pulmonary: Object.freeze({
        engine: 'Vent',
        initialization: simulation.initialization,
        airwayPressureCmH2O: simulation.state.airwayPressure,
        airwayFlowLps: simulation.state.totalFlow,
        totalLungVolumeL: simulation.state.totalVolume,
        measurements: mechanics,
        recentWaveform,
        waveformStatus: 'most-recent-2000-committed-Vent-samples',
        gasExchangeAuthority: 'HumMod reduced ARDS core',
      }),
      systemic: liveSystemicView(),
      coupling: Object.freeze({
        mode: 'live-reduced-hummod-ards-core',
        systemicResponseToVentInterventions: 'modeled-experimentally',
        fullHumModEquivalent: false,
        clinicalValidation: false,
        referenceMeanAirwayPressureCmH2O,
        mechanicalWarmupSec,
        nativeCalibrationApplied: Boolean(nativeCalibrationTarget),
        nativeGasStateApplied: Boolean(nativeState),
        nativeCirculationStateApplied: Boolean(nativeCirculationVolumes),
      }),
      events: Object.freeze(sessionEvents.slice()),
      engineeringBoundaries: Object.freeze({
        ...LIVE_HUMMOD_ENGINEERING_BOUNDARIES,
        circulation: Object.freeze({
          ...LIVE_HUMMOD_ENGINEERING_BOUNDARIES.circulation,
          boundaries: effectiveCirculationBoundaries,
        }),
        nativeCalibration: nativeCalibrationTarget ? Object.freeze({
          targetId: nativeCalibrationTarget.targetId,
          heartRateApplied: nativeHeartRate,
          gasStateApplied: Boolean(nativeState),
          circulationStateApplied: Boolean(nativeCirculationVolumes),
        }) : null,
      }),
      provenance: Object.freeze({
        pulmonary: 'Vent mechanistic engine',
        systemic: 'reduced source-aligned HumMod ARDS cardiopulmonary core',
        clinicalCase: 'synthetic Berlin ARDS authored reference case',
        boundaryStatus: LIVE_HUMMOD_ENGINEERING_BOUNDARIES.status,
      }),
    });
  }

  function stepCoupled(seconds) {
    nonNegative(seconds, 'seconds');
    let remaining = seconds;
    while (remaining > 1e-9) {
      const h = Math.min(1, remaining);
      simulation.runFor(h);
      systemicSnapshot = systemicRuntime.step({ dtSec: h });
      remaining -= h;
    }
  }

  function advanceUntilMeasurement(kind, previousCount, maxAdvanceSec) {
    positive(maxAdvanceSec, 'maxAdvanceSec');
    const start = simulation.state.t;
    const deadline = start + maxAdvanceSec;
    while (simulation.state.t < deadline) {
      const result = simulation.step();
      if (result.failed) {
        const error = new Error(
          'Simulation stopped during passive mechanics measurement: ' +
          (result.output.failureKind || 'STEP_FAILED'));
        error.diagnostics = result.output;
        throw error;
      }
      const count = simulation.measurements.filter(m => m.kind === kind).length;
      if (count > previousCount) return simulation.state.t - start;
    }
    throw new Error('passive mechanics measurement did not complete within maxAdvanceSec');
  }

  return Object.freeze({
    kind: 'berlin-clinical-twin-live-hummod-session',
    clinicalCase,
    simulation,

    initialize() {
      if (initialized) return snapshot();
      initialized = true;
      stepCoupled(1);
      sessionEvents.push(Object.freeze({
        t: systemicSnapshot.timeSec,
        kind: 'SESSION_INITIALIZED',
        systemicMode: 'live-reduced-hummod-ards-core',
      }));
      return snapshot();
    },

    runFor(seconds) {
      if (!initialized) throw new Error('session must be initialized before runFor');
      stepCoupled(seconds);
      return snapshot();
    },

    setPEEP(value) {
      if (!initialized) throw new Error('session must be initialized before interventions');
      simulation.setPEEP(value);
      sessionEvents.push(Object.freeze({
        t: systemicSnapshot.timeSec,
        kind: 'SET_PEEP',
        valueCmH2O: value,
        pulmonaryResponse: 'modeled-by-Vent',
        systemicResponse: 'modeled-by-live-reduced-HumMod-core-on-next-advance',
      }));
      return snapshot();
    },

    requestVentilationChange(nextVentilation) {
      if (!initialized) throw new Error('session must be initialized before interventions');
      const nextController = buildLiveController(nextVentilation);
      const requested = simulation.requestControllerChange(nextController, {
        source: 'clinical-twin-live-hummod-session',
      });
      sessionEvents.push(Object.freeze({
        t: systemicSnapshot.timeSec,
        kind: 'REQUEST_VENTILATION_CHANGE',
        fromMode: requested.fromMode,
        toMode: requested.toMode,
        application: 'next-completed-breath-boundary',
        systemicResponse: 'modeled-by-live-reduced-HumMod-core-after-application-and-advance',
      }));
      return snapshot();
    },

    performPassiveMechanicsMeasurement({
      holdDurationSec = 0.5,
      maxAdvanceSecPerHold = 90,
    } = {}) {
      if (!initialized) throw new Error('session must be initialized before interventions');
      positive(holdDurationSec, 'holdDurationSec');
      positive(maxAdvanceSecPerHold, 'maxAdvanceSecPerHold');
      if (simulation.pendingControllerChange) {
        throw new Error('passive mechanics measurement requires stable ventilator settings; a controller change is pending');
      }
      if (simulation.pendingManeuver || simulation.activeManeuver) {
        throw new Error('a ventilator maneuver is already pending or active');
      }

      const startVentTime = simulation.state.t;
      const inspiratoryCount = simulation.measurements
        .filter(m => m.kind === 'INSPIRATORY_HOLD').length;
      simulation.requestInspiratoryHold(holdDurationSec);
      advanceUntilMeasurement('INSPIRATORY_HOLD', inspiratoryCount, maxAdvanceSecPerHold);

      const expiratoryCount = simulation.measurements
        .filter(m => m.kind === 'EXPIRATORY_HOLD').length;
      simulation.requestExpiratoryHold(holdDurationSec);
      advanceUntilMeasurement('EXPIRATORY_HOLD', expiratoryCount, maxAdvanceSecPerHold);

      const elapsed = simulation.state.t - startVentTime;
      if (elapsed > 0) systemicSnapshot = systemicRuntime.step({ dtSec: elapsed });
      sessionEvents.push(Object.freeze({
        t: systemicSnapshot.timeSec,
        kind: 'PASSIVE_MECHANICS_MEASUREMENT_COMPLETED',
        systemicCouplingApproximation:
          'systemic core advanced once across maneuver elapsed time using final recent mean-airway-pressure state',
      }));
      return snapshot();
    },

    requestInspiratoryHold(durationSec = 0.5) {
      if (!initialized) throw new Error('session must be initialized before interventions');
      positive(durationSec, 'durationSec');
      if (simulation.pendingControllerChange) {
        throw new Error('inspiratory hold requires stable ventilator settings; a controller change is pending');
      }
      if (simulation.pendingManeuver || simulation.activeManeuver) {
        throw new Error('a ventilator maneuver is already pending or active');
      }
      const startVentTime = simulation.state.t;
      const previousCount = simulation.measurements
        .filter(m => m.kind === 'INSPIRATORY_HOLD').length;
      simulation.requestInspiratoryHold(durationSec);
      advanceUntilMeasurement('INSPIRATORY_HOLD', previousCount, 90);
      const elapsed = simulation.state.t - startVentTime;
      if (elapsed > 0) systemicSnapshot = systemicRuntime.step({ dtSec: elapsed });
      const mechanics = summarizeSimulationMeasurements(simulation);
      sessionEvents.push(Object.freeze({
        t: systemicSnapshot.timeSec,
        kind: 'INSPIRATORY_HOLD_COMPLETED',
        plateauPressureCmH2O: mechanics.plateauPressureCmH2O,
        holdDurationSec: durationSec,
      }));
      return snapshot();
    },

    requestExpiratoryHold(durationSec = 0.5) {
      if (!initialized) throw new Error('session must be initialized before interventions');
      positive(durationSec, 'durationSec');
      if (simulation.pendingControllerChange) {
        throw new Error('expiratory hold requires stable ventilator settings; a controller change is pending');
      }
      if (simulation.pendingManeuver || simulation.activeManeuver) {
        throw new Error('a ventilator maneuver is already pending or active');
      }
      const startVentTime = simulation.state.t;
      const previousCount = simulation.measurements
        .filter(m => m.kind === 'EXPIRATORY_HOLD').length;
      simulation.requestExpiratoryHold(durationSec);
      advanceUntilMeasurement('EXPIRATORY_HOLD', previousCount, 90);
      const elapsed = simulation.state.t - startVentTime;
      if (elapsed > 0) systemicSnapshot = systemicRuntime.step({ dtSec: elapsed });
      const mechanics = summarizeSimulationMeasurements(simulation);
      sessionEvents.push(Object.freeze({
        t: systemicSnapshot.timeSec,
        kind: 'EXPIRATORY_HOLD_COMPLETED',
        totalPeepCmH2O: mechanics.totalPeepCmH2O,
        intrinsicPeepCmH2O: mechanics.intrinsicPeepCmH2O,
        holdDurationSec: durationSec,
      }));
      return snapshot();
    },

    snapshot,
  });
}

module.exports = {
  LIVE_HUMMOD_REFERENCE_CASE_ID,
  LIVE_HUMMOD_ENGINEERING_BOUNDARIES,
  createBerlinLiveHumModSession,
};
