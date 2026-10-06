// ventilator/pc_ac.js — Pressure-Control Assist/Control controller.
//
// Square-wave airway-pressure target: hold Paw = PEEP for EXPIRATION,
// Paw = PEEP + pinsp for INSPIRATION, optional PAUSE at PEEP + pinsp.
// Same boundary contract as vc_ac.js — never duplicates mechanics.
//
// Required settings:
//   fio2, peep, rr, pinsp (inspiratory pressure above PEEP), inspiratoryTime
// Optional:
//   inspiratoryPause (s), default 0
//
// Boundary emission:
//   INSPIRATION: makeBoundaryPressure({pressureCmH2O: peep + pinsp, fio2})
//   PAUSE:       makeBoundaryPressure({pressureCmH2O: peep + pinsp, fio2})
//                (same target — pause is just a hold at the same pressure)
//   EXPIRATION:  zero flow; simulator layer sets Paw = PEEP.
//
// The controller does NOT measure or compute Vt — Vt emerges from the
// passive lung mechanics under the commanded pressure.

const { BreathTracker, BreathPhase } = require('./controller.js');
const {
  makeBoundaryPressure, makeBoundaryFlow,
} = require('../contracts.js');

class PcAcController {
  constructor(settings) {
    ['peep', 'rr', 'fio2', 'pinsp', 'inspiratoryTime'].forEach(k => {
      if (typeof settings[k] !== 'number' || !Number.isFinite(settings[k])) {
        throw new Error(`PcAcSettings.${k} must be finite number`);
      }
    });
    if (!(settings.rr > 0)) throw new Error('rr must be > 0');
    if (!(settings.pinsp > 0)) throw new Error('pinsp must be > 0');
    if (!(settings.inspiratoryTime > 0)) {
      throw new Error('inspiratoryTime must be > 0');
    }
    if (settings.peep < 0) throw new Error('peep must be ≥ 0');
    if (settings.fio2 < 0 || settings.fio2 > 1) {
      throw new Error('fio2 must be in [0,1]');
    }
    if (settings.inspiratoryPause != null && settings.inspiratoryPause < 0) {
      throw new Error('inspiratoryPause must be ≥ 0');
    }
    // Validate that inspiratory time fits within breath period.
    const tiTotal = settings.inspiratoryTime + (settings.inspiratoryPause || 0);
    const tBreath = 60 / settings.rr;
    if (tiTotal >= tBreath) {
      throw new Error(
        `inspiratory time ${settings.inspiratoryTime.toFixed(3)} + pause ` +
        `${(settings.inspiratoryPause || 0).toFixed(3)} exceeds breath ` +
        `period ${tBreath.toFixed(3)} at RR=${settings.rr}`
      );
    }
    this.settings = {
      fio2: settings.fio2,
      peep: settings.peep,
      rr: settings.rr,
      pinsp: settings.pinsp,
      inspiratoryTime: settings.inspiratoryTime,
      inspiratoryPause: settings.inspiratoryPause || 0,
    };
    this.tracker = new BreathTracker({
      rr: this.settings.rr,
      ti: this.settings.inspiratoryTime,
      pause: this.settings.inspiratoryPause,
    });
    this.phaseTime = 0;
    this.cycleTime = 0;
    this.breathIndex = 0;
  }

  get breath() { return this.breathIndex; }
  get phase() { return this.tracker.phaseFor(this.cycleTime); }

  step(_state, dt, _deliveredSinceBreathStart = 0) {
    if (!(dt > 0)) throw new Error('dt must be > 0');

    if (this.tracker.isBreathComplete(this.cycleTime)) {
      this.tracker.beginBreath();
      this.cycleTime = 0;
      this.phaseTime = 0;
    }

    const phase = this.tracker.phaseFor(this.cycleTime);
    let boundary;

    if (phase === BreathPhase.INSPIRATION || phase === BreathPhase.PAUSE) {
      // Square-wave pressure target: PEEP + pinsp during both INSPIRATION
      // and PAUSE. The simulator layer handles Paw = PEEP during EXPIRATION.
      boundary = makeBoundaryPressure({
        pressureCmH2O: this.settings.peep + this.settings.pinsp,
        fio2: this.settings.fio2,
      });
    } else {
      // EXPIRATION: zero flow; simulator sets Paw = PEEP.
      boundary = makeBoundaryFlow({ flowLps: 0, fio2: this.settings.fio2 });
    }

    this.phaseTime += dt;
    this.cycleTime += dt;
    return boundary;
  }
}

module.exports = { PcAcController };
