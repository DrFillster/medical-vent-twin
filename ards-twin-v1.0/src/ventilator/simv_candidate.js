'use strict';

const { BreathPhase } = require('./controller.js');
const { makeBoundaryPressure } = require('../contracts.js');

const SOURCE = Object.freeze({
  role: 'candidate pressure-SIMV plus pressure-support controller',
  authority: 'candidate-not-canonical',
  limitation:
    'Synchronization, trigger, and cycle-off parameters require source-reproduction validation before activation.',
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

class SimvCandidateController {
  constructor(settings = {}) {
    const required = [
      'fio2',
      'peep',
      'mandatoryRatePerMin',
      'mandatoryPinspCmH2O',
      'mandatoryInspiratoryTimeSec',
      'pressureSupportCmH2O',
      'triggerPmusCmH2O',
      'cycleOffFraction',
      'minSupportInspiratoryTimeSec',
      'maxSupportInspiratoryTimeSec',
      'syncWindowSec',
    ];
    for (const key of required) finite(settings[key], 'SIMV.' + key);
    if (settings.fio2 < 0 || settings.fio2 > 1) throw new Error('fio2 must be in [0,1]');
    if (settings.peep < 0) throw new Error('peep must be >= 0');
    positive(settings.mandatoryRatePerMin, 'mandatoryRatePerMin');
    positive(settings.mandatoryPinspCmH2O, 'mandatoryPinspCmH2O');
    positive(settings.mandatoryInspiratoryTimeSec, 'mandatoryInspiratoryTimeSec');
    if (settings.pressureSupportCmH2O < 0) throw new Error('pressureSupportCmH2O must be >= 0');
    positive(settings.triggerPmusCmH2O, 'triggerPmusCmH2O');
    fraction(settings.cycleOffFraction, 'cycleOffFraction');
    positive(settings.minSupportInspiratoryTimeSec, 'minSupportInspiratoryTimeSec');
    positive(settings.maxSupportInspiratoryTimeSec, 'maxSupportInspiratoryTimeSec');
    if (settings.maxSupportInspiratoryTimeSec <= settings.minSupportInspiratoryTimeSec) {
      throw new Error('maxSupportInspiratoryTimeSec must exceed minSupportInspiratoryTimeSec');
    }
    if (settings.syncWindowSec < 0) throw new Error('syncWindowSec must be >= 0');

    const period = 60 / settings.mandatoryRatePerMin;
    if (settings.mandatoryInspiratoryTimeSec >= period) {
      throw new Error('mandatory inspiratory time must be shorter than mandatory period');
    }
    if (settings.syncWindowSec >= period) {
      throw new Error('syncWindowSec must be shorter than mandatory period');
    }

    this.settings = { ...settings };
    this.phase = BreathPhase.EXPIRATION;
    this.phaseTime = 0;
    this.timeSinceMandatoryStartSec = period;
    this.breathIndex = 0;
    this.mandatoryBreathCount = 0;
    this.spontaneousBreathCount = 0;
    this.activeBreathType = null;
    this.peakInspiratoryFlowLps = 0;
    this.lastCycleReason = null;
    this.source = SOURCE;
    this.controlAuthority = false;
  }

  get breath() { return this.breathIndex; }

  _startMandatory() {
    this.phase = BreathPhase.INSPIRATION;
    this.phaseTime = 0;
    this.timeSinceMandatoryStartSec = 0;
    this.breathIndex += 1;
    this.mandatoryBreathCount += 1;
    this.activeBreathType = 'MANDATORY';
    this.peakInspiratoryFlowLps = 0;
    this.lastCycleReason = null;
  }

  _startSpontaneous() {
    this.phase = BreathPhase.INSPIRATION;
    this.phaseTime = 0;
    this.breathIndex += 1;
    this.spontaneousBreathCount += 1;
    this.activeBreathType = 'SPONTANEOUS_PS';
    this.peakInspiratoryFlowLps = 0;
    this.lastCycleReason = null;
  }

  _endInspiration(reason) {
    this.phase = BreathPhase.EXPIRATION;
    this.phaseTime = 0;
    this.activeBreathType = null;
    this.lastCycleReason = reason;
  }

  step(state, dt, _deliveredSinceBreathStart = 0, patientMusclePressureCmH2O = 0) {
    positive(dt, 'dt');
    finite(patientMusclePressureCmH2O, 'patientMusclePressureCmH2O');

    const period = 60 / this.settings.mandatoryRatePerMin;
    this.timeSinceMandatoryStartSec += dt;

    if (this.phase === BreathPhase.EXPIRATION) {
      const effortTrigger =
        patientMusclePressureCmH2O >= this.settings.triggerPmusCmH2O;
      const inSyncWindow =
        this.timeSinceMandatoryStartSec >= period - this.settings.syncWindowSec;
      const mandatoryDue = this.timeSinceMandatoryStartSec >= period;

      if (mandatoryDue || (effortTrigger && inSyncWindow)) {
        this._startMandatory();
      } else if (effortTrigger) {
        this._startSpontaneous();
      }
    } else if (this.activeBreathType === 'MANDATORY') {
      if (this.phaseTime >= this.settings.mandatoryInspiratoryTimeSec) {
        this._endInspiration('MANDATORY_TIME');
      }
    } else if (this.activeBreathType === 'SPONTANEOUS_PS') {
      const flow = state && Number.isFinite(state.totalFlow)
        ? Math.max(0, state.totalFlow)
        : 0;
      this.peakInspiratoryFlowLps = Math.max(this.peakInspiratoryFlowLps, flow);
      const flowCycle =
        this.phaseTime >= this.settings.minSupportInspiratoryTimeSec &&
        this.peakInspiratoryFlowLps > 0 &&
        flow <= this.peakInspiratoryFlowLps * this.settings.cycleOffFraction;
      const effortEnded =
        this.phaseTime >= this.settings.minSupportInspiratoryTimeSec &&
        patientMusclePressureCmH2O <= 0;
      const timedOut =
        this.phaseTime >= this.settings.maxSupportInspiratoryTimeSec;
      if (flowCycle || effortEnded || timedOut) {
        this._endInspiration(
          timedOut ? 'MAX_SUPPORT_TIME' : flowCycle ? 'FLOW_CYCLE' : 'EFFORT_ENDED'
        );
      }
    }

    let pressureCmH2O = this.settings.peep;
    if (this.phase === BreathPhase.INSPIRATION) {
      pressureCmH2O += this.activeBreathType === 'MANDATORY'
        ? this.settings.mandatoryPinspCmH2O
        : this.settings.pressureSupportCmH2O;
    }

    this.phaseTime += dt;
    return makeBoundaryPressure({
      pressureCmH2O,
      fio2: this.settings.fio2,
    });
  }

  snapshot() {
    return Object.freeze({
      mode: 'SIMV_PC_PS_CANDIDATE',
      phase: this.phase,
      phaseTimeSec: this.phaseTime,
      timeSinceMandatoryStartSec: this.timeSinceMandatoryStartSec,
      breathIndex: this.breathIndex,
      mandatoryBreathCount: this.mandatoryBreathCount,
      spontaneousBreathCount: this.spontaneousBreathCount,
      activeBreathType: this.activeBreathType,
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
  SimvCandidateController,
});
