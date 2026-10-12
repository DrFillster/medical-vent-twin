'use strict';

/**
 * Severinghaus 1979 standard human oxyhemoglobin dissociation curve.
 *
 * Source:
 * Severinghaus JW. Simple, accurate equations for human blood O2 dissociation
 * computations. J Appl Physiol. 1979;46(3):599-602.
 * DOI: 10.1152/jappl.1979.46.3.599.
 *
 * Candidate use only.
 * This module represents the standard curve. It does NOT claim to account for
 * patient-specific pH, temperature, PCO2, 2,3-DPG, fetal Hb, COHb, or MetHb.
 */

const SOURCE=Object.freeze({
  citation:'Severinghaus JW. J Appl Physiol. 1979;46(3):599-602.',
  doi:'10.1152/jappl.1979.46.3.599',
  pmid:'35496',
  equations:Object.freeze([1,2]),
  authority:'candidate-not-canonical',
  condition:'standard-human-oxygen-dissociation-curve',
});

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)){
    throw new Error(label+' must be finite');
  }
  return v;
}
function positive(v,label){
  finite(v,label);
  if(!(v>0)) throw new Error(label+' must be > 0');
  return v;
}
function fractionalSaturation(v,label='fractionalSaturation'){
  finite(v,label);
  if(!(v>0&&v<1)) throw new Error(label+' must be between 0 and 1');
  return v;
}

// Severinghaus 1979 Eq. 1.
// S = 1 / ( 23400 / (PO2^3 + 150*PO2) + 1 )
function standardSaturationFromPo2(pO2MmHg){
  positive(pO2MmHg,'pO2MmHg');
  return 1/(23400/(pO2MmHg**3+150*pO2MmHg)+1);
}

// Severinghaus 1979 Eq. 2.
// ln(PO2) = 0.385 ln[(S^-1 - 1)^-1] + 3.32
//           - 1/(72*S) - 0.17*S^6
function standardPo2FromSaturation(saturationFraction){
  const s=fractionalSaturation(saturationFraction);
  const oddsInverse=1/(1/s-1);
  const lnPo2=
    0.385*Math.log(oddsInverse)+
    3.32-
    1/(72*s)-
    0.17*(s**6);
  return Math.exp(lnPo2);
}

function protocolMappingFromReportedSaO2({
  reportedSaO2Fraction,
  sourceProtocol,
}={}){
  const s=fractionalSaturation(reportedSaO2Fraction,'reportedSaO2Fraction');
  if(typeof sourceProtocol!=='string'||!sourceProtocol.trim()){
    throw new Error('sourceProtocol is required');
  }
  return Object.freeze({
    reportedSaO2Fraction:s,
    standardCurvePaO2MmHg:standardPo2FromSaturation(s),
    mappingAuthority:'candidate-protocol-approximation-only',
    exactProtocolMatch:false,
    limitations:Object.freeze([
      'standard curve only',
      'study-specific pH not incorporated',
      'study-specific temperature not incorporated',
      'study-specific PCO2 shift not incorporated',
      '2,3-DPG not incorporated',
      'dyshemoglobins not incorporated',
    ]),
    sourceProtocol,
    provenance:SOURCE,
  });
}

module.exports=Object.freeze({
  SOURCE,
  standardSaturationFromPo2,
  standardPo2FromSaturation,
  protocolMappingFromReportedSaO2,
});
