'use strict';
// Research-only correction. No fallback to silently ignored nested kinetics.
const assert=require('assert');
const {optionsFor}=require('./explicit_patient_state_adapter');
function declaredRecruitmentOptions(config){
 const legacy=optionsFor(config),cp=legacy.patientMechanicsParams.compartments.find(x=>x.id==='recruitable');assert(cp&&cp.recruitment,'declared kinetics required');
 const keys=['P_open','P_close','k_open','k_close'];const declared=Object.fromEntries(keys.map(k=>[k,cp.recruitment[k]]));
 for(const k of keys)assert(Number.isFinite(declared[k])&&declared[k]>=0,'invalid declared '+k);assert(declared.P_close<declared.P_open);
 return optionsFor({...config,recruitmentKinetics:declared});
}
module.exports={declaredRecruitmentOptions};
