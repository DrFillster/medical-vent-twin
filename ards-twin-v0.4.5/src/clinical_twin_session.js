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
  dt = 0.002,
} = {}) {
  const clinicalCase = getBerlinCase(caseId);
  validateHumModTrajectoryExport(humModExport);
  validateRecruitmentState(initialRecruitmentState);
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
      pulmonary: Object.freeze({
        engine: 'Vent',
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
      const sys = systemicRuntime.sample(simulation.state.t);
      systemicSnapshot = sys.systemic;
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

    requestInspiratoryHold(durationSec) {
      if (!initialized) throw new Error('session must be initialized before interventions');
      simulation.requestInspiratoryHold(durationSec);
      sessionEvents.push(Object.freeze({
        t: simulation.state.t,
        kind: 'REQUEST_INSPIRATORY_HOLD',
      }));
      return snapshot();
    },

    requestExpiratoryHold(durationSec) {
      if (!initialized) throw new Error('session must be initialized before interventions');
      simulation.requestExpiratoryHold(durationSec);
      sessionEvents.push(Object.freeze({
        t: simulation.state.t,
        kind: 'REQUEST_EXPIRATORY_HOLD',
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
