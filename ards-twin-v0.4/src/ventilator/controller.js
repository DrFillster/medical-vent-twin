// ventilator/controller.js — common breath/phase accounting.
//
// A breath cycle:
//   EXPIRATION → INSPIRATION → PAUSE (optional) → EXPIRATION
// Breath period T_breath = 60 / RR seconds.
// Ti = Vt / Q_insp (target inspiratory time).
// Pause occupies remaining (T_breath - Ti) − Te.
//
// Quadratic solve: inspiratory flow Q is fixed by Vt and Ti; if Vt/Ti > flowLimit,
// the cycle is invalid (raised as InvalidState).

function sq(x) { return x * x; }

class BreathPhase {
  static EXPIRATION = 'EXPIRATION';
  static INSPIRATION = 'INSPIRATION';
  static PAUSE = 'PAUSE';
}

class BreathTracker {
  constructor({ rr, ti, pause, cycleTime = 0 }) {
    if (!(rr > 0)) throw new Error('rr must be > 0');
    this.rr = rr;
    this.ti = ti;
    this.pause = pause || 0;
    this.cycleTime = cycleTime;
    this.breathIndex = 0;
  }

  beginBreath() {
    this.cycleTime = 0;
    this.breathIndex += 1;
  }

  // Return phase for current cycleTime. ti is full inspiration length.
  phaseFor(cycleTime) {
    if (cycleTime < this.ti) return BreathPhase.INSPIRATION;
    if (cycleTime < this.ti + this.pause) return BreathPhase.PAUSE;
    return BreathPhase.EXPIRATION;
  }

  breathPeriod() { return 60 / this.rr; }

  // Total inspiration time including pause = ti + pause.
  isBreathComplete(cycleTime) {
    return cycleTime >= this.breathPeriod();
  }
}

module.exports = { BreathPhase, BreathTracker };
