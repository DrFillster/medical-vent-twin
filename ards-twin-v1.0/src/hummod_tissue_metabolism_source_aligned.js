'use strict';

const {humModSource}=require('./hummod_source_identity.js');

const CAL_PER_MIN_PER_G=Object.freeze({
  bone:0.0081,
  fat:0.0018,
  giTract:0.0718,
  otherTissue:0.0106,
});

const SOURCE_PATHS=Object.freeze({
  bone:'Structure/Bone/Bone-Metabolism.DES',
  fat:'Structure/Fat/Fat-Metabolism.DES',
  giTract:'Structure/GITract/GITract-Metabolism.DES',
  otherTissue:'Structure/OtherTissue/OtherTissue-Metabolism.DES',
});

function finite(v,label){if(typeof v!=='number'||!Number.isFinite(v))throw new Error(label+' must be finite');return v;}
function nonNegative(v,label){finite(v,label);if(v<0)throw new Error(label+' must be >= 0');return v;}

function tissueMetabolicO2Need({
  tissue,
  massG,
  calMultiplier=1,
  thyroidEffect,
  heatMetabolismCore,
  structureEffect,
  calToO2,
}={}){
  if(!Object.prototype.hasOwnProperty.call(CAL_PER_MIN_PER_G,tissue)){
    throw new Error('unsupported tissue metabolism: '+tissue);
  }
  nonNegative(massG,'massG');
  nonNegative(calMultiplier,'calMultiplier');
  finite(thyroidEffect,'thyroidEffect');
  finite(heatMetabolismCore,'heatMetabolismCore');
  finite(structureEffect,'structureEffect');
  finite(calToO2,'calToO2');

  const normalCalsUsed=
    calMultiplier*
    CAL_PER_MIN_PER_G[tissue]*
    massG;
  const totalCalsUsed=
    normalCalsUsed*
    thyroidEffect*
    heatMetabolismCore*
    structureEffect;
  const o2NeedMlPerMin=calToO2*totalCalsUsed;

  return Object.freeze({
    tissue,
    massG,
    normalCalsUsed,
    totalCalsUsed,
    o2NeedMlPerMin,
    provenance:Object.freeze({
      status:'source-aligned-equation',
      source:humModSource(SOURCE_PATHS[tissue],tissue+'-Metabolism.CalcCals'),
      clinicalValidation:false,
    }),
  });
}

module.exports={CAL_PER_MIN_PER_G,SOURCE_PATHS,tissueMetabolicO2Need};
