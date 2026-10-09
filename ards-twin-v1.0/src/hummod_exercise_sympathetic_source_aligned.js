'use strict';

const {HUMMOD_SOURCE_IDENTITY}=require('./hummod_source_identity.js');
const {hermite}=require('./hummod_ards_autonomic_source_aligned.js');

const MOTOR_RADIATION_CURVE=Object.freeze([
  Object.freeze({x:0,y:0,slope:0.004}),
  Object.freeze({x:500,y:2.2,slope:0.002}),
  Object.freeze({x:1000,y:2.6,slope:0}),
]);

const METABOREFLEX_PH_CURVE=Object.freeze([
  Object.freeze({x:6.5,y:5,slope:0}),
  Object.freeze({x:6.9,y:0,slope:0}),
]);

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite');
  return v;
}

function motorRadiationTotalEffect(totalWatts){
  finite(totalWatts,'totalWatts');
  return hermite(MOTOR_RADIATION_CURVE,totalWatts);
}

function skeletalMuscleMetaboreflexNerveActivity({
  skeletalMusclePh,
  skeletalMuscleFunctionFailed=false,
}={}){
  finite(skeletalMusclePh,'skeletalMusclePh');
  if(skeletalMuscleFunctionFailed) return 0;
  return hermite(METABOREFLEX_PH_CURVE,skeletalMusclePh);
}

function exerciseSympsTotalEffect({
  totalWatts,
  skeletalMusclePh,
  skeletalMuscleFunctionFailed=false,
}={}){
  const radiationEffect=motorRadiationTotalEffect(totalWatts);
  const metaboreflexNerveActivity=skeletalMuscleMetaboreflexNerveActivity({
    skeletalMusclePh,
    skeletalMuscleFunctionFailed,
  });
  const metaboreflexEffect=0.32*metaboreflexNerveActivity;
  return Object.freeze({
    radiationEffect,
    metaboreflexNerveActivity,
    metaboreflexEffect,
    totalEffect:radiationEffect+metaboreflexEffect,
    provenance:Object.freeze({
      status:'source-aligned',
      sourceRepository:HUMMOD_SOURCE_IDENTITY.canonicalRepository,
      sourceRevision:HUMMOD_SOURCE_IDENTITY.canonicalRevision,
      sourceStructures:Object.freeze([
        'MotorRadiation',
        'SkeletalMuscle-Metaboreflex',
        'ExerciseSymps',
      ]),
      clinicalValidation:false,
    }),
  });
}

module.exports={
  MOTOR_RADIATION_CURVE,
  METABOREFLEX_PH_CURVE,
  motorRadiationTotalEffect,
  skeletalMuscleMetaboreflexNerveActivity,
  exerciseSympsTotalEffect,
};
