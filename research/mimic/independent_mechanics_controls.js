'use strict';
// Research-only parameter builder. Retains common compartment template;
// not a diagnosis-specific model and not connected to production fitting.
const {mechanicsParams}=require('./fit_controlled_mechanics');
function independentMechanicsParams({elasticScale=1,capacityScale=1,resistanceScale=1}={}){
 for(const [k,v]of Object.entries({elasticScale,capacityScale,resistanceScale})){
  if(typeof v!=='number'||!Number.isFinite(v)||v<=0)throw Error(k+' must be finite and positive');
 }
 const p=mechanicsParams(1,1);
 for(const c of p.compartments){c.elasticScale*=elasticScale;c.capacity*=capacityScale;}
 p.centralAirwayResistance*=resistanceScale;
 return p;
}
module.exports={independentMechanicsParams};
