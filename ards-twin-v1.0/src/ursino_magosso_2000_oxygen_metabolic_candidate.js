'use strict';

/**
 * Ursino & Magosso 2000 oxygen transport / cardiac metabolic primitives.
 *
 * Primary source:
 * Ursino M, Magosso E. Acute cardiovascular response to isocapnic hypoxia.
 * I. A mathematical model. Am J Physiol Heart Circ Physiol.
 * 2000;279:H149-H165. doi:10.1152/ajpheart.2000.279.1.H149.
 *
 * IMPORTANT UNIT BOUNDARY:
 * - Eq. 44 / Table 3 report arterial O2 concentration with C = 9 mmol/L.
 * - Eq. 43 defines venous O2 concentration in mL O2 / mL blood and combines
 *   it with Mdot/F where Mdot is mL O2/s and flow is mL blood/s.
 * - This module does NOT invent an implicit mmol/L -> mL/mL conversion.
 * - Therefore Eq. 43 is exposed only as a same-unit mass-balance primitive.
 */

const SOURCE=Object.freeze({
  citation:
    'Ursino M, Magosso E. Acute cardiovascular response to isocapnic hypoxia. I. A mathematical model. Am J Physiol Heart Circ Physiol. 2000;279:H149-H165.',
  doi:'10.1152/ajpheart.2000.279.1.H149',
  equations:Object.freeze([43,44,45,46,47,48]),
  parameterTable:3,
  authority:'candidate-not-canonical',
});

const P=Object.freeze({
  dissociation:Object.freeze({
    saturationConcentrationMmolPerL:9,
    exponentA:0.3836,
    alphaPerMmHg:0.03198,
    betaPerMmHg:0.008275,
    KmmHg:14.99,
  }),
  metabolism:Object.freeze({
    muscleO2ConsumptionMlPerSec:0.86,
    brainO2ConsumptionMlPerSec:0.7917,
    heartBasalO2ConsumptionMlPerSec:0.4,
    heartBasalPowerMmHgMlPerSec:12660,
    cardiacPowerTauSec:5,
  }),
  nominalVenousO2:Object.freeze({
    brainMlO2PerMlBlood:0.14,
    heartMlO2PerMlBlood:0.11,
    muscleMlO2PerMlBlood:0.155,
  }),
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
function nonNegative(v,label){
  finite(v,label);
  if(v<0) throw new Error(label+' must be >= 0');
  return v;
}

// Eq. 45: Spencer O2 dissociation auxiliary factor.
function oxygenDissociationFactor({pao2MmHg,paco2MmHg=40}={}){
  nonNegative(pao2MmHg,'pao2MmHg');
  nonNegative(paco2MmHg,'paco2MmHg');
  const p=P.dissociation;
  return pao2MmHg*(1+p.betaPerMmHg*paco2MmHg)/
    (p.KmmHg*(1+p.alphaPerMmHg*paco2MmHg));
}

// Eq. 44, preserving the source Table 3 concentration unit.
function arterialO2ConcentrationMmolPerL({pao2MmHg,paco2MmHg=40}={}){
  const F=oxygenDissociationFactor({pao2MmHg,paco2MmHg});
  const p=P.dissociation;
  const x=F**(1/p.exponentA);
  return p.saturationConcentrationMmolPerL*x/(1+x);
}

// Eq. 43 expressed only for quantities already in one concentration system.
// For the published mL O2/mL blood form, oxygenConsumptionPerSec must be
// mL O2/s and bloodFlowPerSec must be mL blood/s.
function venousO2ConcentrationSameUnits({
  arterialO2Concentration,
  oxygenConsumptionPerSec,
  bloodFlowPerSec,
}={}){
  nonNegative(arterialO2Concentration,'arterialO2Concentration');
  nonNegative(oxygenConsumptionPerSec,'oxygenConsumptionPerSec');
  positive(bloodFlowPerSec,'bloodFlowPerSec');
  return arterialO2Concentration-oxygenConsumptionPerSec/bloodFlowPerSec;
}

// Eq. 46.
function heartO2ConsumptionMlPerSec({averagePumpPowerMmHgMlPerSec}={}){
  nonNegative(averagePumpPowerMmHgMlPerSec,'averagePumpPowerMmHgMlPerSec');
  const p=P.metabolism;
  return averagePumpPowerMmHgMlPerSec/
    p.heartBasalPowerMmHgMlPerSec*
    p.heartBasalO2ConsumptionMlPerSec;
}

// Eq. 47.
// dV/dt is positive during filling and negative during ejection; therefore
// the source minus sign yields positive pump power during ejection.
function instantaneousCardiacPumpPowerMmHgMlPerSec({
  leftVentriclePressureMmHg,
  dLeftVentricleVolumeDtMlPerSec,
  rightVentriclePressureMmHg,
  dRightVentricleVolumeDtMlPerSec,
}={}){
  for(const [k,v] of Object.entries({
    leftVentriclePressureMmHg,
    dLeftVentricleVolumeDtMlPerSec,
    rightVentriclePressureMmHg,
    dRightVentricleVolumeDtMlPerSec,
  })) finite(v,k);

  return -leftVentriclePressureMmHg*dLeftVentricleVolumeDtMlPerSec
    -rightVentriclePressureMmHg*dRightVentricleVolumeDtMlPerSec;
}

// Eq. 48.
function averageCardiacPumpPowerDerivative({
  instantaneousPumpPowerMmHgMlPerSec,
  averagePumpPowerMmHgMlPerSec,
}={}){
  finite(instantaneousPumpPowerMmHgMlPerSec,
    'instantaneousPumpPowerMmHgMlPerSec');
  finite(averagePumpPowerMmHgMlPerSec,'averagePumpPowerMmHgMlPerSec');
  return (
    instantaneousPumpPowerMmHgMlPerSec-averagePumpPowerMmHgMlPerSec
  )/P.metabolism.cardiacPowerTauSec;
}

module.exports=Object.freeze({
  SOURCE,P,
  oxygenDissociationFactor,
  arterialO2ConcentrationMmolPerL,
  venousO2ConcentrationSameUnits,
  heartO2ConsumptionMlPerSec,
  instantaneousCardiacPumpPowerMmHgMlPerSec,
  averageCardiacPumpPowerDerivative,
});
