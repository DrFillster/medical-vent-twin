'use strict';

// clinical_twin_session.js
//
// End-to-end composition for one synthetic Berlin ARDS case.
//
// Ownership:
// - Vent owns ventilator settings, lung mechanics, recruitment state,
//   waveforms and explicit hold-derived respiratory measurements.
// - HumMod replay owns the normalized systemic/gas-exchange snapshot fields
//   present in the validated source trajectory.
// - The browser gas-exchange approximation is disabled in this composition to
//   avoid two engines simultaneously claiming authority over PaO2/PaCO2.
//
// This module does not infer missing ventilator settings, PBW-derived tidal
// volume, or recruitment state. Callers must provide them explicitly.

const { getBerlinCase } = require('./berlin_case_catalog.js');
const { makePatientParams } = require('./contracts.js');
const { Simulation, VcAcController, PcAcController } = require('./simulation.js');
const { summarizeSimulationMeasurements } = require('./bedside_measurements.js');
const { createBerlinHumModReplayRuntime } = require('./clinical_twin_runtime.js');
const { validateHumModTrajectoryExport } = require('./hummod_export_contract.js');

function finite(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
  return value;
}

function positive(value, label) {
  finite(value, label);
  if (!(value > 0)) throw new Error(`${label} must be > 0`);
  return value;
}

function nonNegative(value, label) {
  finite(value, label);
  if (value < 0) throw new Error(`${label} must be non-negative`);
  return value;
}

function fraction(value, label) {
  finite(value, label);
  if (value < 0 || value > 1) throw new Error(`${label} must be in [0,1]`);
  return value;
}

function validateRecruitmentState(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('initialRecruitmentState is required');
  }
  ['normal', 'recruitable', 'consolidated'].forEach(key => finite(value[key], `initialRecruitmentState.${key}`));
  if (value.normal !== 1) throw new Error('initialRecruitmentState.normal must be 1');
  if (value.consolidated !== 0) throw new Error('initialRecruitmentState.consolidated must be 0');
  if (value.recruitable < 0 || value.recruitable > 1) {
    throw new Error('initialRecruitmentState.recruitable must be in [0,1]');
  }
  return value;
}

function buildController(ventilation) {
  if (!ventilation || typeof ventilation !== 'object' || Array.isArray(ventilation)) {
    throw new Error('ventilation settings are required');
  }
  const mode = ventilation.mode;
  const common = {
    fio2: fraction(ventilation.fio2, 'ventilation.fio2'),
    peep: nonNegative(ventilation.peep, 'ventilation.peep'),
    rr: positive(ventilation.rr, 'ventilation.rr'),
  };

  if (mode === 'VC_AC') {
    return new VcAcController({
      ...common,
      vt: positive(ventilation.vtL, 'ventilation.vtL'),
      inspiratoryFlow: positive(ventilation.inspiratoryFlowLps, 'ventilation.inspiratoryFlowLps'),
      inspiratoryPause: ventilation.inspiratoryPauseSec == null
        ? 0
        : nonNegative(ventilation.inspiratoryPauseSec, 'ventilation.inspiratoryPauseSec'),
    });
  }

  if (mode === 'PC_AC') {
    return new PcAcController({
      ...common,
      pinsp: positive(ventilation.pinspCmH2O, 'ventilation.pinspCmH2O'),
      inspiratoryTime: positive(ventilation.inspiratoryTimeSec, 'ventilation.inspiratoryTimeSec'),
      inspiratoryPause: ventilation.inspiratoryPauseSec == null
        ? 0
        : nonNegative(ventilation.inspiratoryPauseSec, 'ventilation.inspiratoryPauseSec'),
    });
  }

  throw new Error('ventilation.mode must be VC_AC or PC_AC');
}

function createBerlinClinicalTwinSession({
  caseId,
  humModExport,
  ventilation,
  initialRecruitmentState,
  initializationHistory,
  dt = 0.002,
} = {}) {
  const clinicalCase = getBerlinCase(caseId);
  validateHumModTrajectoryExport(humModExport);
  if (initialRecruitmentState) {
    validateRecruitmentState(initialRecruitmentState);
  } else if (!initializationHistory) {
    throw new Error('initialRecruitmentState or initializationHistory is required');
  }
  positive(dt, 'dt');

  const controller = buildController(ventilation);
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

  const systemicRuntime = createBerlinHumModReplayRuntime({
    caseId,
    humModExport,
  });

  const trajectoryEndSec = humModExport.rows[humModExport.rows.length - 1].timestampSec;
  const sessionEvents = [];
  let initialized = false;
  let systemicSnapshot = null;

  function currentVentSettings() {
    const s = simulation.controller.settings;
    const base = {
      fio2: s.fio2,
      peepCmH2O: s.peep,
      rrPerMin: s.rr,
    };
    if (simulation.controller instanceof VcAcController) {
      return Object.freeze({
        ...base,
        mode: 'VC_AC',
        vtL: s.vt,
        inspiratoryFlowLps: s.inspiratoryFlow,
        inspiratoryPauseSec: s.inspiratoryPause,
      });
    }
    return Object.freeze({
      ...base,
      mode: 'PC_AC',
      pinspCmH2O: s.pinsp,
      inspiratoryTimeSec: s.inspiratoryTime,
      inspiratoryPauseSec: s.inspiratoryPause,
    });
  }

  function snapshot() {
    const mechanics = summarizeSimulationMeasurements(simulation);
    const recentWaveform = Object.freeze(
      simulation.trace.slice(-2000).map(row => Object.freeze({
        t: row.t,
        pressureCmH2O: row.output.airwayPressure,
        flowLps: row.output.airwayFlow,
        volumeL: row.output.totalVolume,
        phase: row.phase,
        maneuver: row.maneuver,
      }))
    );
    return Object.freeze({
      sessionSchema: 'berlin-clinical-twin-session/v1',
      timeSec: simulation.state.t,
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
        compartments: Object.freeze(simulation.state.compartments.map(c => Object.freeze({
          id: c.id,
          volumeL: c.volume,
          flowLps: c.flow,
          alveolarPressureCmH2O: c.alveolarPressure,
          recruitment: c.recruitment,
        }))),
        measurements: mechanics,
        recentWaveform,
        waveformStatus: 'most-recent-2000-committed-Vent-samples',
        gasExchangeAuthority: 'disabled-in-Vent-for-composed-session',
      }),
      systemic: systemicSnapshot,
      coupling: Object.freeze({
        mode: 'shared-clock-replay',
        systemicResponseToVentInterventions: 'not-modeled-by-fixed-replay',
        trajectoryEndSec,
      }),
      events: Object.freeze(sessionEvents.slice()),
      provenance: Object.freeze({
        pulmonary: 'Vent mechanistic engine',
        systemic: 'validated HumMod trajectory replay',
        clinicalCase: 'synthetic Berlin ARDS authored case with cohort-calibrated targets',
      }),
    });
  }

  function syncSystemicToVentTime() {
    const sys = systemicRuntime.sample(simulation.state.t);
    systemicSnapshot = sys.systemic;
  }

  function advanceUntilMeasurement(kind, previousCount, maxAdvanceSec) {
    positive(maxAdvanceSec, 'maxAdvanceSec');
    const deadline = Math.min(simulation.state.t + maxAdvanceSec, trajectoryEndSec);
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
      if (count > previousCount) return;
    }
    if (simulation.state.t >= trajectoryEndSec) {
      throw new Error(
        'HumMod trajectory ended before the requested passive mechanics measurement completed');
    }
    throw new Error('passive mechanics measurement did not complete within maxAdvanceSec');
  }

  return Object.freeze({
    kind: 'berlin-clinical-twin-session',
    clinicalCase,
    simulation,
    trajectoryEndSec,

    initialize() {
      if (initialized) return snapshot();
      const sys = systemicRuntime.initialize();
      systemicSnapshot = sys.systemic;
      initialized = true;
      sessionEvents.push(Object.freeze({
        t: simulation.state.t,
        kind: 'SESSION_INITIALIZED',
      }));
      return snapshot();
    },

    runFor(seconds) {
      if (!initialized) throw new Error('session must be initialized before runFor');
      nonNegative(seconds, 'seconds');
      const target = simulation.state.t + seconds;
      if (target > trajectoryEndSec) {
        throw new Error(
          `requested session time ${target} exceeds HumMod trajectory end ${trajectoryEndSec}; fixed replay cannot extrapolate`);
      }
      simulation.runFor(seconds);
      syncSystemicToVentTime();
      return snapshot();
    },

    setPEEP(value) {
      if (!initialized) throw new Error('session must be initialized before interventions');
      simulation.setPEEP(value);
      sessionEvents.push(Object.freeze({
        t: simulation.state.t,
        kind: 'SET_PEEP',
        valueCmH2O: value,
        pulmonaryResponse: 'modeled-by-Vent',
        systemicResponse: 'not-modeled-by-fixed-HumMod-replay',
      }));
      return snapshot();
    },

    requestVentilationChange(nextVentilation) {
      if (!initialized) throw new Error('session must be initialized before interventions');
      const nextController = buildController(nextVentilation);
      const requested = simulation.requestControllerChange(nextController, {
        source: 'clinical-twin-session',
      });
      sessionEvents.push(Object.freeze({
        t: simulation.state.t,
        kind: 'REQUEST_VENTILATION_CHANGE',
        fromMode: requested.fromMode,
        toMode: requested.toMode,
        application: 'next-completed-breath-boundary',
        pulmonaryResponse: 'modeled-by-Vent-after-application',
        systemicResponse: 'not-modeled-by-fixed-HumMod-replay',
      }));
      return snapshot();
    },

    performPassiveMechanicsMeasurement({
      holdDurationSec = 0.5,
      maxAdvanceSecPerHold = 90,
    } = {}) {
      if (!initialized) {
        throw new Error('session must be initialized before interventions');
      }
      positive(holdDurationSec, 'holdDurationSec');
      positive(maxAdvanceSecPerHold, 'maxAdvanceSecPerHold');
      if (simulation.pendingControllerChange) {
        throw new Error(
          'passive mechanics measurement requires stable ventilator settings; a controller change is pending');
      }
      if (simulation.pendingManeuver || simulation.activeManeuver) {
        throw new Error('a ventilator maneuver is already pending or active');
      }

      const startSec = simulation.state.t;
      const inspiratoryCount = simulation.measurements
        .filter(m => m.kind === 'INSPIRATORY_HOLD').length;
      simulation.requestInspiratoryHold(holdDurationSec);
      advanceUntilMeasurement(
        'INSPIRATORY_HOLD', inspiratoryCount, maxAdvanceSecPerHold);

      const expiratoryCount = simulation.measurements
        .filter(m => m.kind === 'EXPIRATORY_HOLD').length;
      simulation.requestExpiratoryHold(holdDurationSec);
      advanceUntilMeasurement(
        'EXPIRATORY_HOLD', expiratoryCount, maxAdvanceSecPerHold);

      syncSystemicToVentTime();
      sessionEvents.push(Object.freeze({
        t: simulation.state.t,
        kind: 'PASSIVE_MECHANICS_MEASUREMENT_COMPLETED',
        startedAtSec: startSec,
        completedAtSec: simulation.state.t,
        source: 'Vent explicit zero-flow inspiratory and expiratory holds',
        systemicResponse: 'not-modeled-by-fixed-HumMod-replay',
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
      const previousCount = simulation.measurements
        .filter(m => m.kind === 'INSPIRATORY_HOLD').length;
      simulation.requestInspiratoryHold(durationSec);
      advanceUntilMeasurement('INSPIRATORY_HOLD', previousCount, 90);
      syncSystemicToVentTime();
      const mechanics = summarizeSimulationMeasurements(simulation);
      sessionEvents.push(Object.freeze({
        t: simulation.state.t,
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
      const previousCount = simulation.measurements
        .filter(m => m.kind === 'EXPIRATORY_HOLD').length;
      simulation.requestExpiratoryHold(durationSec);
      advanceUntilMeasurement('EXPIRATORY_HOLD', previousCount, 90);
      syncSystemicToVentTime();
      const mechanics = summarizeSimulationMeasurements(simulation);
      sessionEvents.push(Object.freeze({
        t: simulation.state.t,
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
  createBerlinClinicalTwinSession,
  buildController,
};
