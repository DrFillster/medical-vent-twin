'use strict';
// Observational adapter for passive, leak-free mechanics. Never uses set VT or
// set RR as a substitute for a missing completed cycle. One-breath feedback lag.
class DeliveredBreathSampler {
  constructor() { this.active=null; this.last=null; this.completed=0; }
  observe({before,after,phase,controller,dt,interrupted=false}) {
    const starts = !interrupted && phase==='INSPIRATION' && controller.cycleTime<=dt+1e-10;
    if(starts) {
      if(this.active) {
        const a=this.active,period=before.t-a.start;
        if(period>0 && a.sawExpiration && !a.invalid) {
          this.completed++;
          this.last=Object.freeze({schema:'measured-passive-ventilation/v1',
            breath:this.completed,startSec:a.start,endSec:before.t,periodSec:period,
            deliveredVtL:a.peakDelta,actualRatePerMin:60/period,
            sourceMode:a.mode,source:'committed-Vent-lung-volume-and-cycle-timestamps',
            passive:true,leakFreeAssumption:true});
        } else this.last=null; // A contaminated cycle cannot leave a silent fallback.
      }
      this.active={start:before.t,initialVolume:before.totalVolume,peakDelta:0,
        mode:controller.mode || controller.constructor.name,sawExpiration:false,invalid:false};
    }
    if(!this.active)return;
    if(interrupted)this.active.invalid=true;
    if(phase==='INSPIRATION')this.active.peakDelta=Math.max(this.active.peakDelta,after.totalVolume-this.active.initialVolume);
    if(phase==='EXPIRATION')this.active.sawExpiration=true;
  }
  sample(nowSec,maxAgeSec) {
    if(!Number.isFinite(maxAgeSec)||maxAgeSec<=0)throw new Error('explicit maxSampleAgeSec must be positive');
    if(!this.last)throw new Error('no valid completed breath; mechanics warmup is required');
    if(!Number.isFinite(nowSec)||nowSec<this.last.endSec||nowSec-this.last.endSec>maxAgeSec)throw new Error('completed-breath sample is stale or in the future');
    return Object.freeze({...this.last,sampledAtSec:nowSec,maxAgeSec});
  }
}
module.exports={DeliveredBreathSampler};
