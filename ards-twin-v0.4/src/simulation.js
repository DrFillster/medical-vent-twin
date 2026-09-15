// simulation.js — top-level simulator wiring clock + mechanics + vent + gas.
//
// Run loop:
//   1. clock.step(dt)
//   2. controller.step(state, dt, deliveredSinceBreathStart)
//   3. If phase is EXPIRATION, override boundary with PRESSURE = PEEP
//   4. mechanics.step(params, state, boundary, dt)
//   5. gas_exchange.step(gas, params, compartments, dt) — V/Q evolution
//   6. monitor records raw signals.

const { SimulationClock } = require('./clock.js');
const { ThreeCompartmentMechanics } = require('./mechanics.js');
const { VcAcController } = require('./ventilator/vc_ac.js');
const { PcAcController } = require('./ventilator/pc_ac.js');
const { BreathPhase } = require('./ventilator/controller.js');
const {
  makeBoundaryPressure, makeInitialState,
} = require('./contracts.js');
const {
  makeInitialGasState, stepGasState, mixedArterialPo2, shuntFraction,
  deadSpaceFraction,
} = require('./gas_exchange.js');
const { analyzeAll } = require('./metrics.js');

class Simulation {
  constructor({ params, controller, dt = 0.001, fio2 = 0.4, trackGas = true }) {
    this.params = params;
    this.controller = controller;
    this.clock = new SimulationClock(dt);
    // v0.4.3: pressure-consistent initialization.
    //
    // Presets MUST own initialPEEP and initialRecruitmentState. makeInitialState
    // pulls them from `params` (the preset). The controller's PEEP is the
    // operating target, not the initializer's input — but if the preset is
    // silent, fall back to controller.settings.peep (legacy compat for tests
    // that don't use presets). The fallback is documented and explicit.
    //
    // If neither preset nor controller can supply initialPEEP, the
    // initializer throws rather than guessing.
    const presetRecState = params.initialRecruitmentState
      && typeof params.initialRecruitmentState === 'object'
      ? params.initialRecruitmentState : null;
    const presetPEEP = typeof params.initialPEEP === 'number'
      ? params.initialPEEP : null;
    const ctrlPEEP = controller.settings
      && typeof controller.settings.peep === 'number'
      ? controller.settings.peep : null;
    const finalPEEP = presetPEEP !== null ? presetPEEP : ctrlPEEP;
    this.state = makeInitialState(params, {
      initialPEEP: finalPEEP,
      initialRecruitmentState: presetRecState
        || { normal: 1, recruitable: 0, consolidated: 0 },
    });
    this.mechanics = new ThreeCompartmentMechanics();
    this.trace = [];
    this.deliveredSinceBreathStart = 0;
    this.peepOverrideActive = false;
    this.fio2 = fio2;
    this.trackGas = trackGas;
    this.gas = trackGas ? makeInitialGasState(params, fio2) : null;
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

  step() {
    const dt = this.clock.dt;

    // 1. controller produces boundary.
    let boundary = this.controller.step(this.state, dt, this.deliveredSinceBreathStart);

    // 2. EXPIRATION phase override: PEEP pressure clamp.
    if (this.controller.phase === BreathPhase.EXPIRATION) {
      boundary = makeBoundaryPressure({
        pressureCmH2O: this.controller.settings.peep,
        fio2: this.controller.settings.fio2,
      });
    }

    // 3. Advance mechanics with the final boundary.
    let { state, output } = this.mechanics.step(this.params, this.state, boundary, dt);

    // v0.4.3: STEP_FAILED contract.
    //
    // If the mechanical solve failed, do NOT commit the new state, do
    // NOT advance time, do NOT update gas exchange or downstream metrics.
    // Return the failure output as diagnostics so the caller can react
    // (retry with smaller dt, abort the breath, surface error).
    if (output.solverFailure) {
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
    if (this.controller.phase === BreathPhase.INSPIRATION) {
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
      phase: this.controller.phase,
      boundaryKind: boundary.kind,
      output,
    });
    return { state, output, boundary, failed: false };
  }

  // Per-breath metrics from the current trace. setPEEP = the controller's
  // set PEEP value (used to compute auto-PEEP).
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

module.exports = { Simulation, VcAcController, PcAcController };
