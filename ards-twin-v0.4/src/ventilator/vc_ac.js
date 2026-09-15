// ventilator/vc_ac.js — Volume-Control Assist/Control controller.
// Passive VCV with square inspiratory flow, optional inspiratory pause.
//
// Phase rules per spec/VENTILATOR_CONTRACT.md:
//   INSPIRATION: request FLOW at Q_insp, FiO2 delivered
//   PAUSE:        request zero flow with closed inspiratory boundary
//                 (MechanicsOutput.flow approaches zero while static pressure
//                 equilibrates)
//   EXPIRATION:   P_airway exposed to PEEP (handled by the simulator layer
//                 with a passive expiration boundary)

const { BreathTracker, BreathPhase } = require('./controller.js');
const { makeBoundaryFlow, makeBoundaryPressure } = require('../contracts.js');

class VcAcController {
  /**
   * @param {object} settings  VcAcSettings from ventilator.spec.ts
   *   { fio2, peep, rr, vt, inspiratoryFlow, inspiratoryPause }
   */
  constructor(settings) {
    ['peep', 'rr', 'vt', 'fio2'].forEach(k => {
      if (typeof settings[k] !== 'number' || !Number.isFinite(settings[k])) {
        throw new Error(`VcAcSettings.${k} must be finite number`);
      }
    });
    if (!(settings.rr > 0)) throw new Error('rr must be > 0');
    if (!(settings.vt > 0)) throw new Error('vt must be > 0');
    if (settings.peep < 0) throw new Error('peep must be ≥ 0');
    if (settings.fio2 < 0 || settings.fio2 > 1) {
      throw new Error('fio2 must be in [0,1]');
    }
    if (!(settings.inspiratoryFlow > 0)) {
      throw new Error('inspiratoryFlow must be > 0');
    }
    if (settings.inspiratoryPause != null && settings.inspiratoryPause < 0) {
      throw new Error('inspiratoryPause must be ≥ 0');
    }
    this.settings = {
      fio2: settings.fio2,
      peep: settings.peep,
      rr: settings.rr,
      vt: settings.vt,
      inspiratoryFlow: settings.inspiratoryFlow,
      inspiratoryPause: settings.inspiratoryPause || 0,
    };
    this.ti = this.settings.vt / this.settings.inspiratoryFlow;
    if (!(this.ti > 0)) throw new Error('inspiration time must be > 0');
    this.tracker = new BreathTracker({
      rr: this.settings.rr,
      ti: this.ti,
      pause: this.settings.inspiratoryPause,
    });
    this.phaseTime = 0;
    this.cycleTime = 0;
    this.breathIndex = 0;
    this.lastBoundaryKind = null;
    this.deliveredThisBreath = 0;
  }

  get breath() { return this.breathIndex; }
  get phase() { return this.tracker.phaseFor(this.cycleTime); }

  /**
   * Advance the controller by dt and return the requested boundary.
   * Simulator passes deliveredVolume (mL since last breath start) so the
   * controller can switch inspiration → pause when target Vt is met.
   *
   * @param {object} state   PatientState
   * @param {number} dt      seconds
   * @param {number} deliveredSinceBreathStart   volume L since this breath's start
   */
  step(_state, dt, deliveredSinceBreathStart = 0) {
    if (!(dt > 0)) throw new Error('dt must be > 0');

    // Begin new breath when current one is complete.
    if (this.tracker.isBreathComplete(this.cycleTime)) {
      this.tracker.beginBreath();
      this.cycleTime = 0;
      this.phaseTime = 0;
      this.deliveredThisBreath = 0;
    }

    const phase = this.tracker.phaseFor(this.cycleTime);
    let boundary;

    if (phase === BreathPhase.INSPIRATION) {
      // Switch inspiration → pause when target Vt has been delivered.
      if (deliveredSinceBreathStart >= this.settings.vt) {
        // zero-flow, observe static pressure (use PAUSE-equivalent boundary)
        boundary = makeBoundaryFlow({ flowLps: 0, fio2: this.settings.fio2 });
        this.lastBoundaryKind = 'PAUSE_FROM_VT_TARGET';
      } else {
        boundary = makeBoundaryFlow({
          flowLps: this.settings.inspiratoryFlow,
          fio2: this.settings.fio2,
        });
        this.lastBoundaryKind = 'INSPIRATION';
      }
    } else if (phase === BreathPhase.PAUSE) {
      boundary = makeBoundaryFlow({ flowLps: 0, fio2: this.settings.fio2 });
      this.lastBoundaryKind = 'PAUSE';
    } else {
      // EXPIRATION: P_airway is set by simulator to PEEP; we hand off
      // responsibility to the simulator by requesting zero flow (the
      // simulator layer is responsible for clamping P_airway at PEEP).
      boundary = makeBoundaryFlow({ flowLps: 0, fio2: this.settings.fio2 });
      this.lastBoundaryKind = 'EXPIRATION';
    }

    this.phaseTime += dt;
    this.cycleTime += dt;
    return boundary;
  }
}

module.exports = { VcAcController };
