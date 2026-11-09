'use strict';

const { BreathPhase } = require('./controller.js');
const { makeBoundaryPressure } = require('../contracts.js');

const SOURCE = Object.freeze({
  role: 'candidate spontaneous pressure-support controller',
  authority: 'candidate-not-canonical',
  limitation:
    'Trigger and cycle-off parameters require source-reproduction validation before bedside-mode activation.',
});

function finite(v, label) {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error(label + ' must be finite');
  }
  return v;
}
function positive(v, label) {
  finite(v, label);
  if (!(v > 0)) throw new Error(label + ' must be > 0');
  return v;
}
function fraction(v, label) {
  finite(v, label);
  if (!(v > 0 && v < 1)) throw new Error(label + ' must be between 0 and 1');
  return v;
}

class PressureSupportCandidateController {
  constructor(settings = {}) {
    const required = [
      'fio2',
      'peep',
      'pressureSupport',
      'triggerPmusCmH2O',
      'cycleOffFraction',
      'minInspiratoryTimeSec',
      'maxInspiratoryTimeSec',
    ];
    for (const key of required) finite(settings[key], 'PressureSupport.' + key);
    if (settings.fio2 < 0 || settings.fio2 > 1) throw new Error('fio2 must be in [0,1]');
    if (settings.peep < 0) throw new Error('peep must be >= 0');
    if (settings.pressureSupport < 0) throw new Error('pressureSupport must be >= 0');
    positive(settings.triggerPmusCmH2O, 'triggerPmusCmH2O');
    fraction(settings.cycleOffFraction, 'cycleOffFraction');
    positive(settings.minInspiratoryTimeSec, 'minInspiratoryTimeSec');
    positive(settings.maxInspiratoryTimeSec, 'maxInspiratoryTimeSec');
    if (settings.maxInspiratoryTimeSec <= settings.minInspiratoryTimeSec) {
      throw new Error('maxInspiratoryTimeSec must exceed minInspiratoryTimeSec');
    }

    this.settings = { ...settings };
    this.phase = BreathPhase.EXPIRATION;
    this.phaseTime = 0;
    this.breathIndex = 0;
    this.peakInspiratoryFlowLps = 0;
    this.lastTriggerPmusCmH2O = null;
    this.lastCycleReason = null;
    this.source = SOURCE;
    this.controlAuthority = false;
  }

  get breath() { return this.breathIndex; }

  step(state, dt, _deliveredSinceBreathStart = 0, patientMusclePressureCmH2O = 0) {
    positive(dt, 'dt');
    finite(patientMusclePressureCmH2O, 'patientMusclePressureCmH2O');

    if (this.phase === BreathPhase.EXPIRATION) {
      if (patientMusclePressureCmH2O >= this.settings.triggerPmusCmH2O) {
        this.phase = BreathPhase.INSPIRATION;
        this.phaseTime = 0;
        this.peakInspiratoryFlowLps = 0;
        this.breathIndex += 1;
        this.lastTriggerPmusCmH2O = patientMusclePressureCmH2O;
        this.lastCycleReason = null;
      }
    } else {
      const flow = state && Number.isFinite(state.totalFlow)
        ? Math.max(0, state.totalFlow)
        : 0;
      this.peakInspiratoryFlowLps = Math.max(this.peakInspiratoryFlowLps, flow);
      const flowCycle =
        this.phaseTime >= this.settings.minInspiratoryTimeSec &&
        this.peakInspiratoryFlowLps > 0 &&
        flow <= this.peakInspiratoryFlowLps * this.settings.cycleOffFraction;
      const effortEnded =
        this.phaseTime >= this.settings.minInspiratoryTimeSec &&
        patientMusclePressureCmH2O <= 0;
      const timedOut = this.phaseTime >= this.settings.maxInspiratoryTimeSec;

      if (flowCycle || effortEnded || timedOut) {
        this.phase = BreathPhase.EXPIRATION;
        this.phaseTime = 0;
        this.lastCycleReason = timedOut
          ? 'MAX_INSPIRATORY_TIME'
          : flowCycle
            ? 'FLOW_CYCLE'
            : 'EFFORT_ENDED';
      }
    }

    const pressureCmH2O = this.phase === BreathPhase.INSPIRATION
      ? this.settings.peep + this.settings.pressureSupport
      : this.settings.peep;

    this.phaseTime += dt;
    return makeBoundaryPressure({
      pressureCmH2O,
      fio2: this.settings.fio2,
    });
  }

  snapshot() {
    return Object.freeze({
      mode: 'PS_CPAP_CANDIDATE',
      phase: this.phase,
      phaseTimeSec: this.phaseTime,
      breathIndex: this.breathIndex,
      peakInspiratoryFlowLps: this.peakInspiratoryFlowLps,
      lastTriggerPmusCmH2O: this.lastTriggerPmusCmH2O,
      lastCycleReason: this.lastCycleReason,
      settings: Object.freeze({ ...this.settings }),
      authority: SOURCE.authority,
      controlAuthority: false,
      provenance: SOURCE,
    });
  }
}

module.exports = Object.freeze({
  SOURCE,
  PressureSupportCandidateController,
});
