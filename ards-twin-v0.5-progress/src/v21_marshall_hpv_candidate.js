'use strict';

/**
 * v2.1 Marshall HPV response candidate for the Das regional perfusion model.
 *
 * Source:
 * Marshall BE, Clarke WR, Costarino AT, Chen L, Miller F, Marshall C.
 * The dose-response relationship for hypoxic pulmonary vasoconstriction.
 * Respir Physiol. 1994;96(2-3):231-247.
 * DOI: 10.1016/0034-5687(94)90129-5.
 *
 * Source experimental population: canine lungs.
 * Das et al. 2015 cite this source for the HPV function used in their
 * human-ARDS simulator. This module is therefore candidate-only and preserves
 * the species limitation explicitly.
 *
 * Source:
 *   PSO2 = PvO2^0.41 * PAO2^0.59
 *   responsePercent =
 *     100 * PSO2^-2.616 / (6.683e-5 + PSO2^-2.616)
 *
 * Marshall reports the maximum PVR at PSO2=10 mmHg as a 3.15-fold increase
 * over the 100%-oxygen baseline. We map the normalized response fraction
 * linearly onto the reported baseline-to-maximum resistance ratio:
 *
 *   deltaV = 1 + (3.15 - 1) * responseFraction
 *
 * That final line is an algebraic conversion from the published normalized
 * response to a resistance multiplier; it is not a fitted gain.
 */

const SOURCE=Object.freeze({
  citation:'Marshall BE et al. Respir Physiol. 1994;96(2-3):231-247.',
  doi:'10.1016/0034-5687(94)90129-5',
  species:'canine',
  usedByHumanArdsModel:
    'Das et al. 2015 cite Marshall 1994 for their HPV vascular-resistance coefficient',
  authority:'candidate-not-canonical',
});

const EXPONENT_VENOUS=0.41;
const EXPONENT_ALVEOLAR=0.59;
const SIGMOID_EXPONENT=-2.616;
const SIGMOID_CONSTANT=6.683e-5;
const MAX_PVR_RATIO=3.15;

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

function marshallStimulusPo2MmHg({
  alveolarPo2MmHg,
  mixedVenousPo2MmHg,
}={}){
  positive(alveolarPo2MmHg,'alveolarPo2MmHg');
  positive(mixedVenousPo2MmHg,'mixedVenousPo2MmHg');
  return Math.pow(mixedVenousPo2MmHg,EXPONENT_VENOUS) *
    Math.pow(alveolarPo2MmHg,EXPONENT_ALVEOLAR);
}

function marshallHpvResponseFraction({
  alveolarPo2MmHg,
  mixedVenousPo2MmHg,
}={}){
  const stimulusPo2MmHg=marshallStimulusPo2MmHg({
    alveolarPo2MmHg,
    mixedVenousPo2MmHg,
  });
  const x=Math.pow(stimulusPo2MmHg,SIGMOID_EXPONENT);
  const responseFraction=x/(SIGMOID_CONSTANT+x);
  return Object.freeze({
    stimulusPo2MmHg,
    responseFraction,
    responsePercent:100*responseFraction,
    provenance:SOURCE,
  });
}

function dasHpvResistanceCoefficientFromMarshall({
  alveolarPo2MmHg,
  mixedVenousPo2MmHg,
}={}){
  const r=marshallHpvResponseFraction({
    alveolarPo2MmHg,
    mixedVenousPo2MmHg,
  });
  const hpvCoefficient=1+(MAX_PVR_RATIO-1)*r.responseFraction;
  return Object.freeze({
    ...r,
    hpvCoefficient,
    baselineResistanceRatio:1,
    maximumResistanceRatio:MAX_PVR_RATIO,
    interpretation:
      'candidate Das deltaV coefficient from Marshall normalized HPV response',
    authority:SOURCE.authority,
  });
}

module.exports=Object.freeze({
  SOURCE,
  EXPONENT_VENOUS,
  EXPONENT_ALVEOLAR,
  SIGMOID_EXPONENT,
  SIGMOID_CONSTANT,
  MAX_PVR_RATIO,
  marshallStimulusPo2MmHg,
  marshallHpvResponseFraction,
  dasHpvResistanceCoefficientFromMarshall,
});
