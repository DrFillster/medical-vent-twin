'use strict';

const {hermite}=require('./hummod_ards_autonomic_source_aligned.js');
const {humModSource}=require('./hummod_source_identity.js');

const HCT_ON_VISCOSITY=Object.freeze([
  Object.freeze({x:0.00,y:0.5,slope:0.8}),
  Object.freeze({x:0.44,y:1.0,slope:3.0}),
  Object.freeze({x:0.80,y:5.0,slope:30.0}),
]);

function finite(v,label){if(typeof v!=='number'||!Number.isFinite(v))throw new Error(label+' must be finite');return v;}

function viscosityFromHematocrit({hematocrit,clamp=false,level=0}={}){
  finite(hematocrit,'hematocrit');
  if(hematocrit<0||hematocrit>1)throw new Error('hematocrit must be between 0 and 1');
  finite(level,'level');
  const value=clamp?level:hermite(HCT_ON_VISCOSITY,hematocrit);
  if(!(value>0))throw new Error('viscosity value must be > 0');
  return Object.freeze({
    value,
    conductanceEffect:1/value,
    provenance:Object.freeze({
      status:'source-aligned-equation',
      source:humModSource('Structure/Circulation/Viscosity.DES','Viscosity.Calc'),
      clinicalValidation:false,
    }),
  });
}

function noAnesthesiaVascularState(){
  return Object.freeze({
    brainFunction:1,
    tidalVolume:1,
    heartContractility:1,
    vascularConductance:1,
    provenance:Object.freeze({
      status:'source-aligned-no-anesthesia',
      source:humModSource('Structure/Anesthesia/NoAnesthesia.DES','Anesthesia.Calc'),
      clinicalValidation:false,
    }),
  });
}

module.exports={HCT_ON_VISCOSITY,viscosityFromHematocrit,noAnesthesiaVascularState};
