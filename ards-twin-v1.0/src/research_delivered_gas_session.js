'use strict';
// Explicit isolated research composition; does not modify the running patient,
// the full live systemic session, or any HumMod gas/acid-base equations.
const {DeliveredBreathSampler}=require('./ventilator/delivered_breaths');
const {createLiveCoreBoundaryFromVent}=require('./hummod_ards_core_vent_adapter');
const {createHumModArdsGasRuntime}=require('./hummod_ards_core_runtime');
function createResearchDeliveredGasSession({simulation,boundaries,maxSampleAgeSec,gasStepSec=.1,researchOnly=false}={}) {
  if(researchOnly!==true)throw new Error('researchOnly: true required');
  if(!simulation || simulation.trackGas)throw new Error('requires a Vent simulation with trackGas:false (one gas-state owner)');
  if(!boundaries || !Number.isFinite(boundaries.pulmonary?.deadSpaceBtpsMl))throw new Error('explicit research gas boundaries and dead space required');
  if(!Number.isFinite(maxSampleAgeSec)||maxSampleAgeSec<=0)throw new Error('maxSampleAgeSec required');
  const dt=simulation.clock.dt;
  const ticks=seconds=>{
    if(!Number.isFinite(seconds)||seconds<0||Math.abs(seconds/dt-Math.round(seconds/dt))>1e-7)throw new Error('duration must lie on the mechanics time grid');
    const n=Math.round(seconds/dt);if(n>1000000)throw new Error('step limit exceeded');return n;
  };
  if(gasStepSec<=0 || ticks(gasStepSec)<1)throw new Error('gasStepSec must resolve the mechanics clock');
  const sampler=new DeliveredBreathSampler();let gas=null;let failed=false;let lastAdapter=null;
  function mechanics(seconds) {
    if(failed)throw new Error('research session failed; create a new session');
    for(let i=0,n=ticks(seconds);i<n;i++) {
      const before=simulation.state;
      try {
        const result=simulation.step();if(result.failed)throw new Error('mechanical solve failed');
        const row=simulation.trace[simulation.trace.length-1];
        sampler.observe({before,after:simulation.state,phase:row.phase,controller:simulation.controller,
          dt,interrupted:Boolean(row.maneuver)});
      } catch(e) {failed=true;throw e;}
    }
  }
  function boundary() {
    if(simulation.pendingManeuver || simulation.activeManeuver)throw new Error('isolated gas trial does not support hold maneuvers');
    return createLiveCoreBoundaryFromVent({simulation,...boundaries,
      researchDeliveredVentilation:{...sampler.sample(simulation.state.t,maxSampleAgeSec),researchOnly:true}});
  }
  return Object.freeze({simulation,sampler,
    warmup(seconds) {if(gas)throw new Error('cannot warm up after gas initialization');mechanics(seconds);return sampler.sample(simulation.state.t,maxSampleAgeSec);},
    initializeGas(options={}) {
      if(gas)throw new Error('gas already initialized');lastAdapter=boundary();
      gas=createHumModArdsGasRuntime({...options,boundary:lastAdapter.boundary});return gas.snapshot();
    },
    runFor(seconds) {
      if(!gas)throw new Error('initialize gas after valid completed-breath warmup');ticks(seconds);
      let remaining=Math.round(seconds/dt);
      while(remaining>0) {
        const h=Math.min(remaining,ticks(gasStepSec))*dt;
        // Use only the sample available at interval start, not future volumes.
        try {lastAdapter=boundary();mechanics(h);} catch(e){failed=true;throw e;}
        try {gas.step({dtSec:h,boundary:lastAdapter.boundary});}
        catch(e){failed=true;throw e;}
        remaining-=Math.round(h/dt);
      }
      return Object.freeze({gas:gas.snapshot(),adapter:lastAdapter,mechanicsTimeSec:simulation.state.t,
        authority:'isolated-research-delivered-ventilation-gas-composition',clinicalValidation:false});
    },
    snapshot() {return {gas:gas?.snapshot() || null,adapter:lastAdapter,mechanicsTimeSec:simulation.state.t,failed};},
  });
}
module.exports={createResearchDeliveredGasSession};
