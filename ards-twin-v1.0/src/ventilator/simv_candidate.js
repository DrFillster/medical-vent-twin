'use strict';

const { BreathPhase } = require('./controller.js');
const { makeBoundaryPressure } = require('../contracts.js');

const SOURCE=Object.freeze({
  citation:'Hennigs C et al. Comput Methods Programs Biomed. 2026;280:109329.',
  equations:'23,24,26,27',sampleIntervalSec:0.01,
  role:'candidate IMV-PC/PS controller with source-aligned assisted trigger/cycling',
  authority:'candidate-not-canonical',
  limitation:'The paper identifies imv-pc/ps as an assisted mode but does not fully specify a vendor-style SIMV synchronization-window algorithm; syncWindowSec remains explicit candidate semantics.',
});
function finite(v,l){if(typeof v!=='number'||!Number.isFinite(v))throw new Error(l+' must be finite');return v;}
function positive(v,l){finite(v,l);if(!(v>0))throw new Error(l+' must be > 0');return v;}
function nonNegative(v,l){finite(v,l);if(v<0)throw new Error(l+' must be >= 0');return v;}
function fraction(v,l){finite(v,l);if(!(v>0&&v<1))throw new Error(l+' must be between 0 and 1');return v;}

class SimvCandidateController{
  constructor(settings={}){
    const required=['fio2','peep','mandatoryRatePerMin','mandatoryPinspCmH2O','mandatoryInspiratoryTimeSec','mandatoryRiseTimeSec','pressureSupportCmH2O','supportRiseTimeSec','flowTriggerLMin','cycleOffFraction','minExpiratoryTimeSec','maxSupportInspiratoryTimeSec','syncWindowSec'];
    for(const k of required)finite(settings[k],'SIMV.'+k);
    if(settings.fio2<0||settings.fio2>1)throw new Error('fio2 must be in [0,1]');
    nonNegative(settings.peep,'peep');positive(settings.mandatoryRatePerMin,'mandatoryRatePerMin');positive(settings.mandatoryPinspCmH2O,'mandatoryPinspCmH2O');positive(settings.mandatoryInspiratoryTimeSec,'mandatoryInspiratoryTimeSec');positive(settings.mandatoryRiseTimeSec,'mandatoryRiseTimeSec');nonNegative(settings.pressureSupportCmH2O,'pressureSupportCmH2O');positive(settings.supportRiseTimeSec,'supportRiseTimeSec');positive(settings.flowTriggerLMin,'flowTriggerLMin');fraction(settings.cycleOffFraction,'cycleOffFraction');nonNegative(settings.minExpiratoryTimeSec,'minExpiratoryTimeSec');positive(settings.maxSupportInspiratoryTimeSec,'maxSupportInspiratoryTimeSec');nonNegative(settings.syncWindowSec,'syncWindowSec');
    const period=60/settings.mandatoryRatePerMin;
    if(settings.mandatoryInspiratoryTimeSec>=period)throw new Error('mandatory inspiratory time must be shorter than mandatory period');
    if(settings.syncWindowSec>=period)throw new Error('syncWindowSec must be shorter than mandatory period');
    this.settings={...settings};this.phase=BreathPhase.EXPIRATION;this.phaseTime=0;this.timeSinceMandatoryStartSec=period;this.breathIndex=0;this.mandatoryBreathCount=0;this.spontaneousBreathCount=0;this.activeBreathType=null;this.peakInspiratoryFlowLps=0;this.lastSampledFlowLps=0;this.sampleAccumulatorSec=0;this.lastTrigger='NONE';this.lastCycleReason=null;this.effortArmed=true;this.source=SOURCE;this.controlAuthority=false;
  }
  get breath(){return this.breathIndex;}
  _sampleFlowTrigger(state,dt){
    this.sampleAccumulatorSec+=dt;
    if(this.sampleAccumulatorSec+1e-12<SOURCE.sampleIntervalSec)return false;
    this.sampleAccumulatorSec-=SOURCE.sampleIntervalSec;
    const flow=state&&Number.isFinite(state.totalFlow)?state.totalFlow:0;
    const threshold=this.settings.flowTriggerLMin/60;
    const trigger=this.phaseTime>=this.settings.minExpiratoryTimeSec&&flow>=threshold&&flow>this.lastSampledFlowLps;
    this.lastSampledFlowLps=flow;return trigger;
  }
  _startMandatory(trigger){this.phase=BreathPhase.INSPIRATION;this.phaseTime=0;this.timeSinceMandatoryStartSec=0;this.breathIndex++;this.mandatoryBreathCount++;this.activeBreathType='MANDATORY';this.peakInspiratoryFlowLps=0;this.lastTrigger=trigger;this.lastCycleReason=null;}
  _startSpontaneous(){this.phase=BreathPhase.INSPIRATION;this.phaseTime=0;this.breathIndex++;this.spontaneousBreathCount++;this.activeBreathType='SPONTANEOUS_PS';this.peakInspiratoryFlowLps=0;this.lastTrigger='FLOW';this.lastCycleReason=null;}
  _end(reason){this.phase=BreathPhase.EXPIRATION;this.phaseTime=0;this.activeBreathType=null;this.sampleAccumulatorSec=0;this.lastCycleReason=reason;}
  step(state,dt,_deliveredSinceBreathStart=0,patientMusclePressureCmH2O=0){
    positive(dt,'dt');const period=60/this.settings.mandatoryRatePerMin;this.timeSinceMandatoryStartSec+=dt;
    if(this.phase===BreathPhase.EXPIRATION){
      if(patientMusclePressureCmH2O<=0)this.effortArmed=true;
      const flowTrigger=this.effortArmed&&patientMusclePressureCmH2O>0&&this._sampleFlowTrigger(state,dt);
      const inSyncWindow=this.timeSinceMandatoryStartSec>=period-this.settings.syncWindowSec;
      const mandatoryDue=this.timeSinceMandatoryStartSec>=period;
      if(flowTrigger)this.effortArmed=false;
      if(mandatoryDue||(flowTrigger&&inSyncWindow))this._startMandatory(mandatoryDue?'TIME':'FLOW_SYNC');
      else if(flowTrigger)this._startSpontaneous();
    }else if(this.activeBreathType==='MANDATORY'){
      if(this.phaseTime>=this.settings.mandatoryInspiratoryTimeSec)this._end('MANDATORY_TIME');
    }else if(this.activeBreathType==='SPONTANEOUS_PS'){
      const flow=state&&Number.isFinite(state.totalFlow)?Math.max(0,state.totalFlow):0;
      this.peakInspiratoryFlowLps=Math.max(this.peakInspiratoryFlowLps,flow);
      const flowCycle=this.peakInspiratoryFlowLps>0&&flow<=this.peakInspiratoryFlowLps*this.settings.cycleOffFraction;
      const timedOut=this.phaseTime>=this.settings.maxSupportInspiratoryTimeSec;
      if(flowCycle||timedOut)this._end(timedOut?'MAX_SUPPORT_TIME':'FLOW_CYCLE');
    }
    let pressure=this.settings.peep;
    if(this.phase===BreathPhase.INSPIRATION){
      const mandatory=this.activeBreathType==='MANDATORY';
      const rise=mandatory?this.settings.mandatoryRiseTimeSec:this.settings.supportRiseTimeSec;
      const delta=mandatory?this.settings.mandatoryPinspCmH2O:this.settings.pressureSupportCmH2O;
      pressure+=delta*Math.min(1,this.phaseTime/rise);
    }
    this.phaseTime+=dt;
    return makeBoundaryPressure({pressureCmH2O:pressure,fio2:this.settings.fio2});
  }
  snapshot(){return Object.freeze({mode:'SIMV_PC_PS_CANDIDATE',phase:this.phase,phaseTimeSec:this.phaseTime,timeSinceMandatoryStartSec:this.timeSinceMandatoryStartSec,breathIndex:this.breathIndex,mandatoryBreathCount:this.mandatoryBreathCount,spontaneousBreathCount:this.spontaneousBreathCount,activeBreathType:this.activeBreathType,lastTrigger:this.lastTrigger,lastCycleReason:this.lastCycleReason,effortArmed:this.effortArmed,settings:Object.freeze({...this.settings}),authority:SOURCE.authority,controlAuthority:false,provenance:SOURCE});}
}
module.exports=Object.freeze({SOURCE,SimvCandidateController});
