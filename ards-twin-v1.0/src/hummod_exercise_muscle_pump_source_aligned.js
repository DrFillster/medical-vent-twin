'use strict';

const {HUMMOD_SOURCE_IDENTITY}=require('./hummod_source_identity.js');
const {hermite}=require('./hummod_ards_autonomic_source_aligned.js');

const MUSCLE_PUMP_CURVE=Object.freeze([
  Object.freeze({x:0,y:1.0,slope:0.005}),
  Object.freeze({x:1600,y:5.0,slope:0}),
]);

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite');
  return v;
}

function exerciseMusclePumpEffect(totalWatts){
  finite(totalWatts,'totalWatts');
  return Object.freeze({
    effect:hermite(MUSCLE_PUMP_CURVE,totalWatts),
    provenance:Object.freeze({
      status:'source-aligned',
      sourceRepository:HUMMOD_SOURCE_IDENTITY.canonicalRepository,
      sourceRevision:HUMMOD_SOURCE_IDENTITY.canonicalRevision,
      sourceStructure:'Exercise-MusclePump',
      nativeUse:'SystemicVeins.Conductance multiplier',
      clinicalValidation:false,
    }),
  });
}

module.exports={MUSCLE_PUMP_CURVE,exerciseMusclePumpEffect};
