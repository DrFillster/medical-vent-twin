'use strict';

/**
 * Foteinou/Scheff inflammation-autonomic integration contract.
 *
 * No live equations are encoded here until the exact source equations and
 * parameter tables selected for this project are transcribed.
 */
const SOURCE=Object.freeze({
  foteinou:Object.freeze({
    citation:'Foteinou PT et al. Physiol Genomics. 2010;42:5-19.',
    doi:'10.1152/physiolgenomics.00184.2009',
    pmid:'20233835',
  }),
  scheff:Object.freeze({
    citation:'Scheff JD et al. Physiol Genomics. 2011;43:951-964.',
    doi:'10.1152/physiolgenomics.00040.2011',
    pmid:'21673075',
  }),
  status:'source-verified-interface-only',
});

function makeInflammationAutonomicShadowUnavailable(input={}){
  if(!input||typeof input!=='object'||Array.isArray(input)){
    throw new Error('input object required');
  }
  return Object.freeze({
    schema:'inflammation-autonomic-shadow/v1',
    input:Object.freeze({...input}),
    autonomicSensitivityModifier:null,
    heartRateVariabilityState:null,
    cardiacTimingState:null,
    controlAuthority:false,
    status:'blocked-pending-equation-and-parameter-transcription-after-sepsis-validation',
    provenance:SOURCE,
  });
}

module.exports=Object.freeze({SOURCE,makeInflammationAutonomicShadowUnavailable});
