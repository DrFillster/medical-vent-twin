'use strict';

// Exact source-aligned HumMod myocardial CO2/bicarbonate mass-balance primitive.
// Pinned source:
// riliescu/hummod-standalone@8dab57e05631f779bf5020fe0dd51874d8ae98c1
// Structure/LeftHeart/LeftHeart-CO2.DES
// Structure/RightHeart/RightHeart-CO2.DES
// Structure/CO2/CO2Tools.DES
// Structure/Metabolism/Metabolism-RespiratoryQuotient.DES

const {
  tissueBaseToGas,
  bloodGasToBase,
}=require('./hummod_acid_base_source_aligned.js');

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite');
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

const LITERS_TO_MOLS=0.0446;
const RESPIRATORY_QUOTIENT=0.8;

const HEART_CONFIG=Object.freeze({
  left:Object.freeze({initialMass:3.5,errorLimit:0.04}),
  right:Object.freeze({initialMass:0.6,errorLimit:0.01}),
});

function calculateMyocardialCo2Derivatives({
  side,
  mass,
  liquidVolumeMl,
  tissueSid,
  bloodFlowMlPerMin,
  o2UseMlPerMin,
  bloodSid,
  arterialHco3,
  dxMin,
  dxUndefined=false,
  respiratoryQuotient=RESPIRATORY_QUOTIENT,
}={}){
  if(side!=='left'&&side!=='right') throw new Error('side must be left or right');
  nonNegative(mass,'mass');
  positive(liquidVolumeMl,'liquidVolumeMl');
  nonNegative(bloodFlowMlPerMin,'bloodFlowMlPerMin');
  nonNegative(o2UseMlPerMin,'o2UseMlPerMin');
  finite(tissueSid,'tissueSid');
  finite(bloodSid,'bloodSid');
  finite(arterialHco3,'arterialHco3');
  finite(respiratoryQuotient,'respiratoryQuotient');
  if(!dxUndefined) positive(dxMin,'dxMin');

  const hco3=mass/liquidVolumeMl;
  const hco3MeqPerL=1000*hco3;
  const pCO2=tissueBaseToGas({hco3,SID:tissueSid}).pCO2;
  const k=bloodFlowMlPerMin/liquidVolumeMl;

  let alpha;
  if(dxUndefined){
    alpha=0;
  } else if((k*dxMin)>=100){
    alpha=4e-44;
  } else {
    alpha=Math.exp(-k*dxMin);
  }

  const inflowGas=respiratoryQuotient*o2UseMlPerMin;
  const inflowBase=LITERS_TO_MOLS*inflowGas;
  const bloodHco3=bloodGasToBase({pCO2,SID:bloodSid}).hco3;
  const outflow0=bloodFlowMlPerMin*(bloodHco3-arterialHco3);
  const outflowBase=(alpha*outflow0)+((1-alpha)*inflowBase);
  const change=inflowBase-outflowBase;

  return Object.freeze({
    side,
    mass,
    hco3,
    hco3MeqPerL,
    pCO2,
    k,
    alpha,
    inflowGas,
    inflowBase,
    bloodHco3,
    outflow0,
    outflowBase,
    change,
    source:Object.freeze({
      initialMass:HEART_CONFIG[side].initialMass,
      errorLimit:HEART_CONFIG[side].errorLimit,
      litersToMols:LITERS_TO_MOLS,
      respiratoryQuotient,
    }),
  });
}

function eulerStepMyocardialCo2(args){
  const d=calculateMyocardialCo2Derivatives(args);
  if(args.dxUndefined) return Object.freeze({...d,nextMass:d.mass});
  return Object.freeze({...d,nextMass:d.mass+d.change*args.dxMin});
}

module.exports={
  LITERS_TO_MOLS,
  RESPIRATORY_QUOTIENT,
  HEART_CONFIG,
  calculateMyocardialCo2Derivatives,
  eulerStepMyocardialCo2,
};
