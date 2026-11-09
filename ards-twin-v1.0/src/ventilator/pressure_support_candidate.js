'use strict';

const { BreathPhase } = require('./controller.js');
const { makeBoundaryPressure } = require('../contracts.js');

const SOURCE = Object.freeze({
  citation:'Hennigs C et al. Comput Methods Programs Biomed. 2026;280:109329.',
  equations:'23,24,26,27',
  sampleIntervalSec:0.01,
  defaultFlowTriggerLMin:1.5,
  defaultCycleOffFraction:0.25,
  role:'source-aligned candidate continuous spontaneous pressure-support controller',
  authority:'candidate-not-canonical',
  limitation:'TE,min, TI,max, backup rate and slope duration remain explicit scenario inputs until their source values are fully reproduced.',
});

function finite(v,label){if(typeof v!=='number'||!Number.isFinite(v))throw new Error(label+' must be finite');return v;}
function positive(v,label){finite(v,label);if(!(v>0))throw new Error(label+' must be > 0');return v;}
function nonNegative(v,label){finite(v,label);if(v<0)throw new Error(label+' must be >= 0');return v;}
function fraction(v,label){finite(v,label);if(!(v>0&&v<1))throw new Error(label+' must be between 0 and 1');return v;}

class PressureSupportCandidateController {
  constructor(settings={}){
    const required=['fio2','peep','pressureSupport','flowTriggerLMin','cycleOffFraction','minExpiratoryTimeSec','maxInspiratoryTimeSec','riseTimeSec','backupRatePerMin'];
    for(const key of required) finite(settings[key],'PressureSupport.'+key);
    if(settings.fio2<0||settings.fio2>1)throw new Error('fio2 must be in [0,1]');
    nonNegative(settings.peep,'peep');
    nonNegative(settings.pressureSupport,'pressureSupport');
    positive(settings.flowTriggerLMin,'flowTriggerLMin');
    fraction(settings.cycleOffFraction,'cycleOffFraction');
    nonNegative(settings.minExpiratoryTimeSec,'minExpiratoryTimeSec');
    positive(settings.maxInspiratoryTimeSec,'maxInspiratoryTimeSec');
    positive(settings.riseTimeSec,'riseTimeSec');
    positive(settings.backupRatePerMin,'backupRatePerMin');
    this.settings={...settings};
    this.phase=BreathPhase.EXPIRATION;
    this.phaseTime=0;
    this.timeSinceBreathStartSec=60/settings.backupRatePerMin;
    this.breathIndex=0;
    this.peakInspiratoryFlowLps=0;
    this.lastSampledFlowLps=0;
    this.sampleAccumulatorSec=0;
    this.lastTrigger='NONE';
    this.lastCycleReason=null;
    this.source=SOURCE;
    this.controlAuthority=false;
  }
  get breath(){return this.breathIndex;}
  _sampleTrigger(state,dt){
    this.sampleAccumulatorSec+=dt;
    if(this.sampleAccumulatorSec+1e-12<SOURCE.sampleIntervalSec)return false;
    this.sampleAccumulatorSec-=SOURCE.sampleIntervalSec;
    const flow=state&&Number.isFinite(state.totalFlow)?state.totalFlow:0;
    const threshold=this.settings.flowTriggerLMin/60;
    const triggered=this.phaseTime>=this.settings.minExpiratoryTimeSec&&flow>=threshold&&flow>this.lastSampledFlowLps;
    this.lastSampledFlowLps=flow;
    return triggered;
  }
  _startInspiration(trigger){
    this.phase=BreathPhase.INSPIRATION;
    this.phaseTime=0;
    this.timeSinceBreathStartSec=0;
    this.breathIndex+=1;
    this.peakInspiratoryFlowLps=0;
    this.lastTrigger=trigger;
    this.lastCycleReason=null;
  }
  step(state,dt){
    positive(dt,'dt');
    this.timeSinceBreathStartSec+=dt;
    if(this.phase===BreathPhase.EXPIRATION){
      const flowTrigger=this._sampleTrigger(state,dt);
      const timedBackup=this.timeSinceBreathStartSec>=60/this.settings.backupRatePerMin;
      if(flowTrigger||timedBackup)this._startInspiration(flowTrigger?'FLOW':'BACKUP_TIME');
    }else{
      const flow=state&&Number.isFinite(state.totalFlow)?Math.max(0,state.totalFlow):0;
      this.peakInspiratoryFlowLps=Math.max(this.peakInspiratoryFlowLps,flow);
      const flowCycle=this.peakInspiratoryFlowLps>0&&flow<=this.peakInspiratoryFlowLps*this.settings.cycleOffFraction;
      const timedOut=this.phaseTime>=this.settings.maxInspiratoryTimeSec;
      if(flowCycle||timedOut){
        this.phase=BreathPhase.EXPIRATION;
        this.phaseTime=0;
        this.sampleAccumulatorSec=0;
        this.lastSampledFlowLps=flow;
        this.lastCycleReason=timedOut?'MAX_INSPIRATORY_TIME':'FLOW_CYCLE';
      }
    }
    let pressureCmH2O=this.settings.peep;
    if(this.phase===BreathPhase.INSPIRATION){
      const ramp=Math.min(1,this.phaseTime/this.settings.riseTimeSec);
      pressureCmH2O+=this.settings.pressureSupport*ramp;
    }
    this.phaseTime+=dt;
    return makeBoundaryPressure({pressureCmH2O,fio2:this.settings.fio2});
  }
  snapshot(){return Object.freeze({
    mode:'CSV_PS_CANDIDATE',phase:this.phase,phaseTimeSec:this.phaseTime,
    breathIndex:this.breathIndex,peakInspiratoryFlowLps:this.peakInspiratoryFlowLps,
    lastSampledFlowLps:this.lastSampledFlowLps,lastTrigger:this.lastTrigger,
    lastCycleReason:this.lastCycleReason,settings:Object.freeze({...this.settings}),
    authority:SOURCE.authority,controlAuthority:false,provenance:SOURCE,
  });}
}

module.exports=Object.freeze({SOURCE,PressureSupportCandidateController});
