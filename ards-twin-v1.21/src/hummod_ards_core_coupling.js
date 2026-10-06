'use strict';

// hummod_ards_core_coupling.js
//
// Canonical Vent -> HumMod-ARDS-Core coupling snapshot.
//
// This deliberately exports raw/mechanistic state rather than inventing
// physiologic reductions. Downstream core implementations can derive the
// quantities they need from these signals with separately validated equations.

function finite(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(label + ' must be a finite number');
  }
  return value;
}

function currentMode(simulation) {
  const name = simulation.controller && simulation.controller.constructor
    ? simulation.controller.constructor.name
    : '';
  if (name === 'VcAcController') return 'VC_AC';
  if (name === 'PcAcController') return 'PC_AC';
  return 'UNKNOWN';
}

function createVentToArdsCoreSnapshot(simulation, { recentSamples = 1000 } = {}) {
  if (!simulation || !simulation.state || !simulation.controller) {
    throw new Error('Vent simulation is required');
  }
  if (!Number.isInteger(recentSamples) || recentSamples < 1) {
    throw new Error('recentSamples must be a positive integer');
  }

  const settings = simulation.controller.settings || {};
  const state = simulation.state;
  const trace = simulation.trace.slice(-recentSamples).map(row => Object.freeze({
    tSec: row.t,
    phase: row.phase,
    maneuver: row.maneuver || null,
    airwayPressureCmH2O: row.output.airwayPressure,
    airwayFlowLps: row.output.airwayFlow,
    totalLungVolumeL: row.output.totalVolume,
  }));

  const compartments = state.compartments.map(c => Object.freeze({
    id: c.id,
    volumeL: finite(c.volume, 'compartment volume'),
    flowLps: finite(c.flow, 'compartment flow'),
    alveolarPressureCmH2O: finite(c.alveolarPressure, 'alveolar pressure'),
    recruitment: finite(c.recruitment, 'recruitment'),
  }));

  return Object.freeze({
    schema: 'vent-to-hummod-ards-core/v1',
    timeSec: finite(state.t, 'simulation time'),
    ventilator: Object.freeze({
      mode: currentMode(simulation),
      fio2: finite(settings.fio2, 'FiO2'),
      peepCmH2O: finite(settings.peep, 'PEEP'),
      rrPerMin: finite(settings.rr, 'respiratory rate'),
      settings: Object.freeze({ ...settings }),
    }),
    mechanics: Object.freeze({
      airwayPressureCmH2O: finite(state.airwayPressure, 'airway pressure'),
      airwayFlowLps: finite(state.totalFlow, 'airway flow'),
      totalLungVolumeL: finite(state.totalVolume, 'total lung volume'),
      compartments: Object.freeze(compartments),
      recentTrace: Object.freeze(trace),
    }),
    couplingInterpretation: Object.freeze({
      status: 'raw-Vent-mechanical-boundary',
      thoracicPressure: 'not-yet-derived',
      transpulmonaryPressure: 'not-yet-derived-without-pleural-pressure-model',
      shuntAndDeadSpace: 'not-yet-derived-by-ARDS-core',
      note: 'No systemic physiologic response is inferred in this boundary object.',
    }),
  });
}

module.exports = {
  createVentToArdsCoreSnapshot,
};
