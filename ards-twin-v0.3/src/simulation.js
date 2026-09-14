// simulation.js — top-level simulator wiring clock + mechanics + vent + monitor.
//
// Run loop:
//   1. clock.step(dt)
//   2. controller.step(state, dt, deliveredSinceBreathStart)
//   3. If phase is EXPIRATION, override boundary with PRESSURE = PEEP
//      (PEEP is the patient's physiologic baseline; passive expiration).
//   4. mechanics.step(params, state, boundary, dt)
//   5. monitor records raw signals.
//
// Outputs (deterministic given the same dt and config):
//   trace: array of { t, phase, boundary, output }
//   summary: per-breath metrics (delivered Vt, peak P, plateau approximation)

const { SimulationClock } = require('./clock.js');
const { ThreeCompartmentMechanics } = require('./mechanics.js');
const { VcAcController } = require('./ventilator/vc_ac.js');
const { BreathPhase } = require('./ventilator/controller.js');
const {
  makeBoundaryPressure, makeInitialState,
} = require('./contracts.js');

class Simulation {
  constructor({ params, controller, dt = 0.001 }) {
    this.params = params;
    this.controller = controller;
    this.clock = new SimulationClock(dt);
    this.state = makeInitialState(params, { initialVolume: 0.05 });
    this.mechanics = new ThreeCompartmentMechanics();
    this.trace = [];
    this.deliveredSinceBreathStart = 0;
    this.peepOverrideActive = false;
  }

  setPEEP(_value) {
    // Reserved for future PEEP changes within a run.
  }

  runFor(seconds) {
    const start = this.state.t;
    const target = start + seconds;
    while (this.state.t < target) {
      this.step();
    }
    return this.trace;
  }

  // Single-step API: clock → controller → mechanics.
  step() {
    const dt = this.clock.dt;
    const tBefore = this.state.t;

    // 1. controller produces boundary.
    let boundary = this.controller.step(this.state, dt, this.deliveredSinceBreathStart);

    // 2. EXPIRATION phase override: PEEP pressure clamp.
    if (this.controller.phase === BreathPhase.EXPIRATION) {
      boundary = makeBoundaryPressure({
        pressureCmH2O: this.controller.settings.peep,
        fio2: this.controller.settings.fio2,
      });
      // Reset per-breath volume accumulator on transition into expiration.
    }

    // 3. Advance mechanics.
    const { state, output } = this.mechanics.step(this.params, this.state, boundary, dt);

    // 4. Track cumulative inspired volume since breath start.
    // Cumulative inspired = ∫ Q_total dt over the inspiration phase.
    // Reverse (expiratory) flow is NOT counted toward deliveredVt.
    if (this.controller.phase === BreathPhase.INSPIRATION && output.airwayFlow > 0) {
      this.deliveredSinceBreathStart += output.airwayFlow * dt;
    } else if (this.controller.phase === BreathPhase.EXPIRATION) {
      // Reset at start of new breath.
      if (this.state.t > 0 && this.controller.cycleTime <= dt) {
        this.deliveredSinceBreathStart = 0;
      }
    }

    // 5. Commit state, append trace.
    this.state = state;
    this.trace.push({
      t: state.t,
      phase: this.controller.phase,
      boundaryKind: boundary.kind,
      output,
    });
    return { state, output, boundary };
  }
}

module.exports = { Simulation };
