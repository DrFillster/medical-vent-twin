'use strict';

/**
 * Hennigs et al. 2026 respiratory-center integration contract.
 *
 * This file intentionally contains no physiologic gains or controller
 * equations. The primary-paper equation/parameter transcription must be
 * completed before a respiratory-center implementation is added.
 */

const HENNIGS_SOURCE=Object.freeze({
  citation:
    'Hennigs C et al. Patient-ventilator interaction—Development of a mathematical model of the respiratory center. Comput Methods Programs Biomed. 2026;280:109329.',
  doi:'10.1016/j.cmpb.2026.109329',
  pmid:'41905158',
  status:'source-verified-interface-only-equations-pending-transcription',
});

function validateHennigsShadowInput(input){
  if(!input||typeof input!=='object'||Array.isArray(input)){
    throw new Error('Hennigs shadow input object required');
  }
  const required=[
    'timeSec',
    'arterialPo2MmHg',
    'arterialPco2MmHg',
    'airwayPressureCmH2O',
    'airwayFlowLps',
    'lungVolumeL',
  ];
  for(const key of required){
    if(typeof input[key]!=='number'||!Number.isFinite(input[key])){
      throw new Error(key+' must be finite');
    }
  }
  return Object.freeze({...input});
}

function makeHennigsShadowUnavailable(input){
  const checked=validateHennigsShadowInput(input);
  return Object.freeze({
    schema:'hennigs-respiratory-center-shadow/v1',
    input:checked,
    respiratoryDrive:null,
    respiratoryRatePerMin:null,
    patientMusclePressureCmH2O:null,
    asynchronyState:null,
    controlAuthority:false,
    status:'blocked-pending-exact-equation-and-parameter-transcription',
    provenance:HENNIGS_SOURCE,
  });
}

module.exports=Object.freeze({
  HENNIGS_SOURCE,
  validateHennigsShadowInput,
  makeHennigsShadowUnavailable,
});
