// simulation.js — top-level simulator wiring clock + mechanics + vent + gas.
//
// Run loop:
//   1. controller.step(dt) unless a bedside hold maneuver freezes the cycle
//   2. apply the final airway boundary
//   3. mechanics.step(params, state, boundary, dt)
//   4. gas_exchange.step(...) when enabled
//   5. monitor records raw signals and maneuver provenance

const { SimulationClock } = require('./clock.js');
const { ThreeCompartmentMechanics } = require('./mechanics.js');
const { VcAcController } = require('./ventilator/vc_ac.js');
const { PcAcController } = require('./ventilator/pc_ac.js');
const { BreathPhase } = require('./ventilator/controller.js');
const {
  makeBoundaryFlow, makeBoundaryPressure, makeInitialState,
} = require('./contracts.js');
const {
  makeInitialGasState, stepGasState, mixedArterialPo2, shuntFraction,
  deadSpaceFraction,
} = require('./gas_exchange.js');
const { analyzeAll } = require('./metrics.js');

const ManeuverKind = Object.freeze({
  INSPIRATORY_HOLD: 'INSPIRATORY_HOLD',
  EXPIRATORY_HOLD: 'EXPIRATORY_HOLD',
});

function median(values) {
  if (!values || values.length === 0) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

class Simulation {
  constructor({
    params, controller, dt = 0.001, fio2 = 0.4, trackGas = true,
    // v0.4.4: scenario-owned initial state. The phenotype (PatientParams)
    // does NOT own initialPEEP or initialRecruitmentState. The simulation
    // caller must supply them explicitly, or pass initializationHistory
    // from which the recruitment state can be derived.
    initialPEEP, initialRecruitmentState, initializationHistory,
  }) {
    this.params = params;
    this.controller = controller;
    this.clock = new SimulationClock(dt);

    // Resolve initialPEEP: prefer caller-supplied scenario value; fall
    // back to controller.settings.peep for tests that wire only one
    // side. We do NOT guess from the phenotype.
    let resolvedPEEP;
    if (typeof initialPEEP === 'number') {
      resolvedPEEP = initialPEEP;
    } else if (controller.settings && typeof controller.settings.peep === 'number') {
      resolvedPEEP = controller.settings.peep;
    } else {
      throw new Error(
        'Simulation: scenario must provide initialPEEP (or controller.settings.peep)');
    }

    // Resolve initial recruitment state.
    //   - If caller supplied initialRecruitmentState, use it.
    //   - If caller supplied initializationHistory, run the recovery
    //     protocol (FE march over the history) — not yet implemented for
    //     full physics, so we reject and ask the caller to provide
    //     initialRecruitmentState explicitly.
    //   - Otherwise, fail explicitly (no guessing).
    let resolvedRecState;
    if (initialRecruitmentState) {
      resolvedRecState = initialRecruitmentState;
    } else if (initializationHistory) {
      throw new Error(
        'Simulation: initializationHistory recovery is reserved for a future ' +
        'release; pass initialRecruitmentState explicitly.');
    } else {
      throw new Error(
        'Simulation: scenario must provide initialRecruitmentState ' +
        '(or initializationHistory). The phenotype does not own recruitment.');
    }

    this.state = makeInitialState(params, {
      initialPEEP: resolvedPEEP,
      initialRecruitmentState: resolvedRecState,
    });
    this.mechanics = new ThreeCompartmentMechanics();
    this.trace = [];
    this.interventions = [];
    this.measurements = [];
    this.pendingManeuver = null;
    this.activeManeuver = null;
    this.lastCommittedPhase = controller.phase;
    this.deliveredSinceBreathStart = 0;
    this.peepOverrideActive = false;
    this.fio2 = fio2;
    this.trackGas = trackGas;
    this.gas = trackGas ? makeInitialGasState(params, fio2) : null;
  }

  // Change PEEP without reconstructing the patient. This is intentionally a
  // state-preserving operation: compartment volumes, pressures, recruitment,
  // controller phase, simulation time, and trace history remain intact. The
  // new setting is applied by the controller / expiratory pressure boundary
  // on subsequent solver steps.
  setPEEP(value) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw new Error('PEEP must be a finite non-negative number');
    }
    if (!this.controller || !this.controller.settings ||
        typeof this.controller.settings.peep !== 'number') {
      throw new Error('Simulation controller does not expose a mutable PEEP setting');
    }

    const previous = this.controller.settings.peep;
    if (value === previous) return value;

    this.controller.settings.peep = value;
    this.interventions.push(Object.freeze({
      t: this.state.t,
      kind: 'SET_PEEP',
      from: previous,
      to: value,
    }));
    return value;
  }

  _requestHold(kind, durationSec) {
    if (!Object.values(ManeuverKind).includes(kind)) {
      throw new Error(`unknown maneuver kind: ${kind}`);
    }
    if (typeof durationSec !== 'number' || !Number.isFinite(durationSec) || durationSec <= 0) {
      throw new Error('hold duration must be a finite positive number');
    }
    if (this.pendingManeuver || this.activeManeuver) {
      throw new Error('a ventilator maneuver is already pending or active');
    }

    this.pendingManeuver = {
      kind,
      durationSec,
      requestedAtSec: this.state.t,
    };
    this.interventions.push(Object.freeze({
      t: this.state.t,
      kind: `REQUEST_${kind}`,
      durationSec,
    }));
    return Object.freeze({ ...this.pendingManeuver });
  }

  requestInspiratoryHold(durationSec = 0.5) {
    return this._requestHold(ManeuverKind.INSPIRATORY_HOLD, durationSec);
  }

  requestExpiratoryHold(durationSec = 0.5) {
    return this._requestHold(ManeuverKind.EXPIRATORY_HOLD, durationSec);
  }

  _shouldActivatePendingManeuver() {
    if (!this.pendingManeuver) return false;
    const phase = this.controller.phase;

    if (this.pendingManeuver.kind === ManeuverKind.INSPIRATORY_HOLD) {
      // Preferred activation is the first PAUSE step. If no pause is
      // configured, activate at the first expiration step while the lung is
      // still at its end-inspiratory state. The controller clock is then
      // frozen for the duration of the occlusion.
      if (phase === BreathPhase.PAUSE) return true;
      return phase === BreathPhase.EXPIRATION &&
        (this.lastCommittedPhase === BreathPhase.INSPIRATION ||
         this.lastCommittedPhase === BreathPhase.PAUSE);
    }

    if (this.pendingManeuver.kind === ManeuverKind.EXPIRATORY_HOLD) {
      // An expiratory hold must occur at end expiration, immediately before
      // the controller would roll into the next breath. This avoids measuring
      // pressure prematurely during ordinary passive expiration.
      const tracker = this.controller.tracker;
      return phase === BreathPhase.EXPIRATION && tracker &&
        typeof tracker.isBreathComplete === 'function' &&
        tracker.isBreathComplete(this.controller.cycleTime);
    }

    return false;
  }

  _activatePendingManeuver() {
    if (!this._shouldActivatePendingManeuver()) return false;
    const pending = this.pendingManeuver;
    this.pendingManeuver = null;
    const currentPhase = this.controller.phase;
    const tracePhase = pending.kind === ManeuverKind.INSPIRATORY_HOLD &&
      currentPhase === BreathPhase.EXPIRATION
      ? this.lastCommittedPhase
      : currentPhase;

    this.activeManeuver = {
      ...pending,
      startedAtSec: this.state.t,
      remainingSec: pending.durationSec,
      tracePhase,
      samples: [],
    };
    this.interventions.push(Object.freeze({
      t: this.state.t,
      kind: `START_${pending.kind}`,
      durationSec: pending.durationSec,
    }));
    return true;
  }

  _completeActiveManeuver() {
    const active = this.activeManeuver;
    if (!active) return null;
    const samples = active.samples;
    const lateStart = Math.floor(samples.length / 2);
    const late = samples.slice(lateStart);
    const pressurePool = late.length ? late : samples;
    const measuredPressure = median(pressurePool.map(s => s.airwayPressureCmH2O));
    const measuredFlow = median(pressurePool.map(s => s.airwayFlowLps));

    const common = {
      kind: active.kind,
      requestedAtSec: active.requestedAtSec,
      startedAtSec: active.startedAtSec,
      completedAtSec: this.state.t,
      requestedDurationSec: active.durationSec,
      sampleCount: samples.length,
      medianLateAirwayFlowLps: measuredFlow,
      source: 'zero-flow airway occlusion in Vent mechanics engine',
    };

    let measurement;
    if (active.kind === ManeuverKind.INSPIRATORY_HOLD) {
      measurement = Object.freeze({
        ...common,
        plateauPressureCmH2O: measuredPressure,
      });
    } else {
      measurement = Object.freeze({
        ...common,
        totalPeepCmH2O: measuredPressure,
        setPeepCmH2O: this.controller.settings.peep,
      });
    }

    this.measurements.push(measurement);
    this.interventions.push(Object.freeze({
      t: this.state.t,
      kind: `COMPLETE_${active.kind}`,
      measurementIndex: this.measurements.length - 1,
    }));
    this.activeManeuver = null;
    return measurement;
  }

  measurementSummary() {
    const latestInspiratory = [...this.measurements].reverse()
      .find(m => m.kind === ManeuverKind.INSPIRATORY_HOLD) || null;
    const latestExpiratory = [...this.measurements].reverse()
      .find(m => m.kind === ManeuverKind.EXPIRATORY_HOLD) || null;
    return Object.freeze({
      plateauPressureCmH2O: latestInspiratory ? latestInspiratory.plateauPressureCmH2O : null,
      totalPeepCmH2O: latestExpiratory ? latestExpiratory.totalPeepCmH2O : null,
      setPeepAtMeasurementCmH2O: latestExpiratory ? latestExpiratory.setPeepCmH2O : null,
      drivingPressureCmH2O: null,
      drivingPressureStatus: 'not-derived-by-core; requires validated downstream calculation',
    });
  }

  runFor(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) throw new Error('Duration must be finite and non-negative');
    const target = this.state.t + seconds;
    const maxSteps = Math.ceil(seconds / this.clock.dt) + 2;
    if (maxSteps > 1000000) throw new Error('Run exceeds one million steps');
    let steps = 0;
    while (this.state.t < target) {
      if (++steps > maxSteps) throw new Error('Simulation stopped: time did not advance');
      const result = this.step();
      if (result.failed) {
        const error = new Error(`Simulation stopped: ${result.output.failureKind || 'STEP_FAILED'}`);
        error.diagnostics = result.output;
        throw error;
      }
    }
    return this.trace;
  }

  step() {
    const dt = this.clock.dt;

    // Activate a queued hold only at its physiologically appropriate phase.
    this._activatePendingManeuver();

    let boundary;
    let tracePhase;
    let controllerSnapshot = null;
    let trackerSnapshot = null;
    let restoreController = () => {};

    if (this.activeManeuver) {
      // Airway occlusion: zero net airway flow while allowing internal
      // compartment pressure redistribution. The ventilator cycle clock is
      // intentionally frozen until the maneuver is complete.
      boundary = makeBoundaryFlow({
        flowLps: 0,
        fio2: this.controller.settings.fio2,
      });
      tracePhase = this.activeManeuver.tracePhase;
    } else {
      // Snapshot mutable controller state so a rejected step is transactional.
      // Both shipped controllers own scalar fields plus a BreathTracker.
      controllerSnapshot = { ...this.controller };
      trackerSnapshot = { ...this.controller.tracker };
      restoreController = () => {
        Object.assign(this.controller, controllerSnapshot);
        Object.assign(this.controller.tracker, trackerSnapshot);
      };

      // 1. controller produces boundary.
      boundary = this.controller.step(this.state, dt, this.deliveredSinceBreathStart);
      tracePhase = this.controller.phase;

      // 2. EXPIRATION phase override: PEEP pressure clamp.
      if (this.controller.phase === BreathPhase.EXPIRATION) {
        boundary = makeBoundaryPressure({
          pressureCmH2O: this.controller.settings.peep,
          fio2: this.controller.settings.fio2,
        });
      }
    }

    // 3. Advance mechanics with the final boundary.
    let result;
    try {
      result = this.mechanics.step(this.params, this.state, boundary, dt);
    } catch (error) {
      restoreController();
      throw error;
    }
    let { state, output } = result;

    // v0.4.3: STEP_FAILED contract.
    //
    // If the mechanical solve failed, do NOT commit the new state, do
    // NOT advance time, do NOT update gas exchange or downstream metrics.
    // Return the failure output as diagnostics so the caller can react
    // (retry with smaller dt, abort the breath, surface error).
    if (output.solverFailure) {
      restoreController();
      this.lastFailure = output;
      // Do not push to trace; do not commit state.
      return { state: this.state, output, boundary, failed: true };
    }

    // 4. Gas exchange (parallel to mechanics, no irreversible coupling).
    if (this.trackGas) {
      this.gas = stepGasState(this.gas, this.params, state.compartments, dt);
    }

    // 5. Track cumulative inspired volume since breath start.
    // We use NET volume change (ΔV), not cumulative FLOW — the latter
    // over-counts because passive recoil leaks some inflow back out
    // through the airway during inspiration. ΔV is what fills the lung
    // and what Vt means clinically.
    if (!this.activeManeuver && this.controller.phase === BreathPhase.INSPIRATION) {
      // Reset at start of a new breath (cycleTime just rolled over to 0).
      if (this.controller.cycleTime <= dt) {
        this.deliveredSinceBreathStart = 0;
        this.inspStartVolume = this.state.totalVolume;
      }
      // Net V change since breath start.
      this.deliveredSinceBreathStart = state.totalVolume - this.inspStartVolume;
    }

    // 6. Commit state, append trace.
    this.state = state;
    this.trace.push({
      t: state.t,
      phase: tracePhase,
      maneuver: this.activeManeuver ? this.activeManeuver.kind : null,
      boundaryKind: boundary.kind,
      output,
    });
    this.lastCommittedPhase = tracePhase;

    // 7. Record hold samples only after a successful committed mechanics step.
    if (this.activeManeuver) {
      this.activeManeuver.samples.push({
        t: state.t,
        airwayPressureCmH2O: output.airwayPressure,
        branchPressureCmH2O: output.branchPressure,
        airwayFlowLps: output.airwayFlow,
        totalVolumeL: output.totalVolume,
      });
      this.activeManeuver.remainingSec -= dt;
      if (this.activeManeuver.remainingSec <= Math.max(1e-12, dt * 1e-6)) {
        this._completeActiveManeuver();
      }
    }

    return { state, output, boundary, failed: false };
  }

  // Per-breath metrics from the current trace. Legacy set-PEEP-derived
  // auto-PEEP remains in metrics.js for backwards compatibility; clinically
  // meaningful total PEEP should use an explicit expiratory hold measurement.
  metrics() {
    const setPEEP = this.controller.settings ? this.controller.settings.peep : 0;
    return analyzeAll(this.trace, setPEEP);
  }

  // Gas exchange summary at current state.
  gasSummary() {
    if (!this.trackGas || !this.gas) return null;
    return {
      pao2: mixedArterialPo2(this.gas, this.params),
      shunt: shuntFraction(this.gas, this.params),
      deadSpace: deadSpaceFraction(this.gas, this.params),
      inspiredPo2: this.gas.inspiredPo2,
    };
  }
}

module.exports = {
  Simulation,
  VcAcController,
  PcAcController,
  ManeuverKind,
};
