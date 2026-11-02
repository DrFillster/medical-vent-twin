'use strict';

// Research-only passive adaptive-pressure surrogate. This is NOT either
// manufacturer's proprietary controller. See docs/ADAPTIVE_VOLUME_MODES.md.
const { PcAcController } = require('./pc_ac.js');
const { BreathPhase } = require('./controller.js');
const { makeBoundaryFlow, makeBoundaryPressure } = require('../contracts.js');
const MBAR_TO_CMH2O = 100 / 98.0665;
function finite(x, name) {
  if (!Number.isFinite(x)) throw new Error(`${name} must be finite`);
  return x;
}
function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

class AdaptiveVolumeController extends PcAcController {
  constructor(settings) {
    if (settings.researchOnly !== true) {
      throw new Error('adaptive modes require researchOnly: true; vendor equivalence is unvalidated');
    }
    if (settings.passive !== true) throw new Error('adaptive surrogate requires explicitly passive: true');
    if (!['VC_AC_AUTOFLOW', 'APV_CMV'].includes(settings.mode)) {
      throw new Error('adaptive mode must be VC_AC_AUTOFLOW or APV_CMV');
    }
    super({ ...settings, pinsp: settings.initialPinsp, inspiratoryPause: 0 });
    for (const key of ['vt', 'minPinsp', 'maxAirwayPressure', 'maxPressureStep', 'adaptationGain', 'volumeToleranceFraction']) {
      finite(settings[key], key);
    }
    if (!(settings.vt > 0) || !(settings.minPinsp > 0) || !(settings.maxPressureStep > 0)) {
      throw new Error('vt, minPinsp and maxPressureStep must be positive');
    }
    if (!(settings.adaptationGain > 0 && settings.adaptationGain <= 1) ||
        !(settings.volumeToleranceFraction >= 0 && settings.volumeToleranceFraction < 1)) {
      throw new Error('explicit adaptationGain must be in (0,1]; volumeToleranceFraction in [0,1)');
    }
    if (settings.inspiratoryPause != null && settings.inspiratoryPause !== 0) {
      throw new Error('adaptive modes use explicit holds, not an implicit inspiratory pause');
    }
    if (settings.mode === 'VC_AC_AUTOFLOW' && settings.maxPressureStep > 3 * MBAR_TO_CMH2O) {
      throw new Error('AutoFlow surrogate step must not exceed documented 3 mbar per breath');
    }
    if (settings.mode === 'APV_CMV') {
      finite(settings.highPressureAlarm, 'highPressureAlarm');
      if (settings.minPinsp < 3 || settings.maxAirwayPressure > settings.highPressureAlarm - 10) {
        throw new Error('APV profile requires minPinsp >=3 and maximum Paw <= highPressureAlarm -10 cmH2O');
      }
    }
    this.settings = { ...this.settings, ...settings, inspiratoryPause: 0 };
    delete this.settings.pinsp; // Actual applied pressure is state, not a fixed setting.
    this.mode = settings.mode;
    this.lastStepPhase = null;
    this.validatePEEP(settings.peep);
    if (settings.initialPinsp < settings.minPinsp || settings.initialPinsp > this.pressureCeiling()) {
      throw new Error('initialPinsp must lie inside the configured pressure limits');
    }
    const strategy = settings.startupStrategy || (this.mode === 'VC_AC_AUTOFLOW' ? 'flow-calibration' : 'low-pressure-probe');
    if (!['flow-calibration','low-pressure-probe','provided-pressure'].includes(strategy) ||
        (strategy === 'flow-calibration' && this.mode !== 'VC_AC_AUTOFLOW')) {
      throw new Error('unsupported startupStrategy for mode');
    }
    if (strategy === 'flow-calibration') {
      finite(settings.calibrationPauseSec, 'calibrationPauseSec');
      if (settings.calibrationPauseSec < 0 || settings.calibrationPauseSec >= settings.inspiratoryTime) {
        throw new Error('calibrationPauseSec must be >=0 and shorter than inspiratoryTime');
      }
    }
    this.settings.startupStrategy = strategy;
    this.startupPending = strategy !== 'provided-pressure';
    this.pinsp = strategy === 'low-pressure-probe' ? settings.minPinsp : settings.initialPinsp;
    this.calibrationEndPinsp = null;
    this.peakAirwayPressure = 0;
    this.inspirationStartVolume = null;
    this.inspiredVolumeL = 0;
    this.completedBreaths = 0;
    this.feedbackInvalidated = false;
    this.feedbackInvalidatedReason = null;
    this.lastBreath = null;
    this.authority = 'research-only-passive-adaptive-surrogate';
  }

  validatePEEP(peep) {
    finite(peep, 'peep');
    if (peep < 0 || peep + this.settings.minPinsp > this.settings.maxAirwayPressure) {
      throw new Error('PEEP leaves insufficient pressure margin for adaptive mode');
    }
  }
  absolutePressureLimit() { return this.settings.maxAirwayPressure; }
  pressureCeiling() { return this.settings.maxAirwayPressure - this.settings.peep; }

  _completeBreath() {
    const measured = this.inspiredVolumeL;
    const oldPinsp = this.pinsp;
    const usable = !this.feedbackInvalidated && measured > 1e-9;
    const errorFraction = usable ? this.settings.vt / measured - 1 : null;
    // Engineering assumption: local Vt ≈ effective compliance * pressure.
    // No vendor feedback equation is claimed; the gain is an explicit input.
    const relativeError = usable ? (this.settings.vt - measured) / this.settings.vt : null;
    const correction = usable && Math.abs(relativeError) > this.settings.volumeToleranceFraction
      ? this.settings.adaptationGain * oldPinsp * errorFraction : 0;
    const bounded = clamp(correction, -this.settings.maxPressureStep, this.settings.maxPressureStep);
    this.pinsp = clamp(oldPinsp + bounded, this.settings.minPinsp, this.pressureCeiling());
    const calibration = this.startupPending && this.settings.startupStrategy === 'flow-calibration';
    const usedCalibration = calibration && usable && Number.isFinite(this.calibrationEndPinsp);
    if (usedCalibration) {
      this.pinsp = clamp(this.calibrationEndPinsp, this.settings.minPinsp, this.pressureCeiling());
    }
    if (usable) this.startupPending = false;
    this.completedBreaths += 1;
    this.lastBreath = Object.freeze({
      breath: this.completedBreaths, targetVtL: this.settings.vt,
      deliveredVtL: measured, appliedPinspCmH2O: oldPinsp,
      targetExceeded: usable && measured > this.settings.vt * (1 + this.settings.volumeToleranceFraction),
      nextPinspCmH2O: this.pinsp, feedbackUsed: usable,
      control: calibration ? 'FLOW_CALIBRATION' : 'ADAPTIVE_PRESSURE',
      peakAirwayPressureCmH2O: this.peakAirwayPressure,
      feedbackStatus: usedCalibration ? 'STARTUP_FLOW_CALIBRATION' : this.feedbackInvalidated ? this.feedbackInvalidatedReason : usable ? 'MEASURED_INSPIRATORY_VOLUME' : 'NO_VALID_VOLUME',
      targetNotAchievedAtPressureLimit: usable &&
        measured < this.settings.vt * (1 - this.settings.volumeToleranceFraction) &&
        this.peakAirwayPressure >= this.settings.maxAirwayPressure - 1e-9,
    });
    this.inspiredVolumeL = 0;
    this.inspirationStartVolume = null;
    this.peakAirwayPressure = 0;
    this.feedbackInvalidated = false;
    this.feedbackInvalidatedReason = null;
  }

  step(state, dt) {
    if (!Number.isFinite(dt) || dt <= 0 || dt > this.settings.inspiratoryTime || dt >= this.tracker.breathPeriod()) {
      throw new Error('adaptive dt must be finite, positive and resolve inspiration and breath period');
    }
    this.validatePEEP(this.settings.peep);
    if (this.tracker.isBreathComplete(this.cycleTime)) {
      this._completeBreath();
      this.tracker.beginBreath();
      this.breathIndex = this.tracker.breathIndex;
      this.cycleTime = 0;
      this.phaseTime = 0;
    }
    this.pinsp = clamp(this.pinsp, this.settings.minPinsp, this.pressureCeiling());
    this.lastStepPhase = this.tracker.phaseFor(this.cycleTime);
    if (this.lastStepPhase === BreathPhase.INSPIRATION && this.inspirationStartVolume === null) {
      this.inspirationStartVolume = finite(state.totalVolume, 'state.totalVolume');
    }
    const calibrationFlow = this.startupPending && this.settings.startupStrategy === 'flow-calibration';
    const boundary = this.lastStepPhase === BreathPhase.INSPIRATION && calibrationFlow
      ? makeBoundaryFlow({ flowLps: Math.max(0, Math.min(this.cycleTime < this.settings.inspiratoryTime - this.settings.calibrationPauseSec
            ? this.settings.vt / (this.settings.inspiratoryTime - this.settings.calibrationPauseSec) : 0,
          (this.settings.vt - this.inspiredVolumeL) / dt)), fio2: this.settings.fio2 })
      : this.lastStepPhase === BreathPhase.INSPIRATION
      ? makeBoundaryPressure({ pressureCmH2O: this.settings.peep + this.pinsp, fio2: this.settings.fio2 })
      : makeBoundaryFlow({ flowLps: 0, fio2: this.settings.fio2 });
    this.cycleTime += dt;
    this.phaseTime += dt;
    return boundary;
  }

  // Called by Simulation only after a successful mechanics commit. Rollback
  // snapshots contain scalars and an immutable lastBreath, so failed steps do
  // not teach the controller about a volume that was never delivered.
  invalidateFeedback(reason) {
    this.feedbackInvalidated = true;
    this.feedbackInvalidatedReason = reason;
  }

  observeCommittedStep(state, phase, interrupted = false) {
    if (interrupted) { this.invalidateFeedback('HOLD_INTERRUPTED'); return; }
    if (phase === BreathPhase.INSPIRATION && this.inspirationStartVolume !== null) {
      this.inspiredVolumeL = Math.max(this.inspiredVolumeL, state.totalVolume - this.inspirationStartVolume);
      this.peakAirwayPressure = Math.max(this.peakAirwayPressure, state.airwayPressure);
      this.calibrationEndPinsp = state.airwayPressure - this.settings.peep;
    }
  }

  diagnostics() {
    return Object.freeze({ mode: this.mode, authority: this.authority,
      patientDomain: 'passive-only; triggering, effort and leaks are not modeled',
      targetVtL: this.settings.vt, currentPinspCmH2O: this.pinsp,
      maxAirwayPressureCmH2O: this.settings.maxAirwayPressure,
      startupStrategy: this.settings.startupStrategy, startupPending: this.startupPending,
      completedBreaths: this.completedBreaths, lastBreath: this.lastBreath });
  }
}
module.exports = { AdaptiveVolumeController, MBAR_TO_CMH2O };
