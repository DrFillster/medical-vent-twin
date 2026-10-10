'use strict';

/**
 * Ursino/Magosso heart-period candidate contract.
 *
 * This module deliberately does not implement the heart-period effector until
 * every gain, delay, threshold, time constant, and basal term is transcribed
 * from the primary source.
 */
const SOURCE=Object.freeze({
  citation:'Ursino M, Magosso E. Am J Physiol Heart Circ Physiol. 2003;284:H1479-H1493.',
  doi:'10.1152/ajpheart.00850.2002',
  pmid:'12595291',
  status:'primary-source-verified-parameters-pending-transcription',
});

function validateInput(input){
  if(!input||typeof input!=='object'||Array.isArray(input)){
    throw new Error('heart-period shadow input object required');
  }
  for(const k of ['timeSec','fShSpikesPerSec','fVSpikesPerSec']){
    if(typeof input[k]!=='number'||!Number.isFinite(input[k])){
      throw new Error(k+' must be finite');
    }
  }
  return Object.freeze({...input});
}

function makeUnavailableHeartPeriodCandidate(input){
  const checked=validateInput(input);
  return Object.freeze({
    schema:'ursino-heart-period-candidate/v1',
    input:checked,
    heartPeriodSec:null,
    heartRatePerMin:null,
    sympatheticContributionSec:null,
    vagalContributionSec:null,
    controlAuthority:false,
    status:'blocked-pending-complete-primary-parameter-transcription',
    provenance:SOURCE,
  });
}

module.exports=Object.freeze({SOURCE,validateInput,makeUnavailableHeartPeriodCandidate});
