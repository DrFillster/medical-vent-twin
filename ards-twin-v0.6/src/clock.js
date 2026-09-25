// clock.js — runtime SimulationClock matching clock.spec.ts.
// Deterministic fixed-step clock. Identical traces across repeated runs.

class SimulationClock {
  constructor(dt) {
    if (!(typeof dt === 'number' && Number.isFinite(dt) && dt > 0)) {
      throw new Error('dt must be > 0 finite number');
    }
    this._t = 0;
    this._steps = 0;
    this.dt = dt;
  }

  get t() { return this._t; }
  get steps() { return this._steps; }

  step() {
    this._t = Math.round((this._t + this.dt) * 1e12) / 1e12;
    this._steps += 1;
    return this._t;
  }

  reset() {
    this._t = 0;
    this._steps = 0;
  }

  // Run a closure for `seconds` real-time, capped by 1e9 steps as safety.
  runFor(seconds, fn) {
    if (typeof seconds !== 'number' || !(seconds > 0)) {
      throw new Error('seconds must be > 0 finite number');
    }
    const total = Math.ceil(seconds / this.dt);
    if (total > 1e9) throw new Error(`runFor too many steps: ${total}`);
    for (let i = 0; i < total; i++) fn(this.step(), this.dt);
  }
}

module.exports = { SimulationClock };
