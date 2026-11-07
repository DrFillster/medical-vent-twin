'use strict';

// Albanese et al. 2016, Table 7, doi:10.1152/ajpheart.00230.2014.
// These are the published parameter revisions, not values fitted to Halliwill.
// Applying them to the 2000 plant is an adaptation, NOT a full 2016 CP Model.
const SOURCE=Object.freeze({
  doi:'10.1152/ajpheart.00230.2014',
  table:7,
  authority:'published-parameter-adaptation-not-full-model-reproduction',
  unchangedComponents:'Ursino-Magosso 2000 plant, afferent chemoreceptor and effector equations',
});
const PARAMETERS=Object.freeze({
  pulmonaryGainSpikesPerSecPerL:11.76,
  // Signed weights in the 2016 table; the 2000 functions subtract the
  // baroreceptor and stretch contributions, so convert signs at that boundary.
  sympatheticWeights:Object.freeze({
    sp:Object.freeze({baro:-1.1375,chemo:1.716,pulmonary:-0.3997}),
    sv:Object.freeze({baro:-1.0806,chemo:1.716,pulmonary:-0.2907}),
    sh:Object.freeze({baro:-1.75,chemo:1,pulmonary:0}),
  }),
  localOxygenGains:Object.freeze({brain:140,heart:490,muscle:420}),
});
const PARAMETER_SET='albanese-2016-table7-adaptation';
function validateParameterSet(name){
  if(!['ursino-magosso-2000',PARAMETER_SET].includes(name)){
    throw new Error('unknown cardiovascular control parameter set: '+name);
  }
  return name;
}
module.exports=Object.freeze({SOURCE,PARAMETERS,PARAMETER_SET,validateParameterSet});
