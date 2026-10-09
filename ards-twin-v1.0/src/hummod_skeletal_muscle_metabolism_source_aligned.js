'use strict';

const {HUMMOD_SOURCE_IDENTITY}=require('./hummod_source_identity.js');

const SOURCE_CONSTANTS=Object.freeze({
  basalCalPerMinPerG:0.0052,
  calToO2:0.2093,
  o2ToCal:4.778,
});

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite');
  return v;
}
function nonNegative(v,label){finite(v,label);if(v<0)throw new Error(label+' must be >= 0');return v;}
function positive(v,label){finite(v,label);if(!(v>0))throw new Error(label+' must be > 0');return v;}

function skeletalMuscleMetabolism({
  muscleMassG,
  calMultiplier=1,
  thyroidEffect=1,
  heatMetabolismEffect=1,
  structureEffect=1,
  workTotalCalsPerMin=0,
  postureCalsPerMin=0,
  shiveringCalsPerMin=0,
  o2UseMlPerMin=null,
}={}){
  positive(muscleMassG,'muscleMassG');
  [
    ['calMultiplier',calMultiplier],
    ['thyroidEffect',thyroidEffect],
    ['heatMetabolismEffect',heatMetabolismEffect],
    ['structureEffect',structureEffect],
  ].forEach(([k,v])=>finite(v,k));
  [
    ['workTotalCalsPerMin',workTotalCalsPerMin],
    ['postureCalsPerMin',postureCalsPerMin],
    ['shiveringCalsPerMin',shiveringCalsPerMin],
  ].forEach(([k,v])=>nonNegative(v,k));
  if(o2UseMlPerMin!=null) nonNegative(o2UseMlPerMin,'o2UseMlPerMin');

  const basalCalsUsed=
    calMultiplier*
    SOURCE_CONSTANTS.basalCalPerMinPerG*
    muscleMassG;
  const totalCalsUsed=
    (basalCalsUsed*thyroidEffect*heatMetabolismEffect*structureEffect)+
    workTotalCalsPerMin+
    postureCalsPerMin+
    shiveringCalsPerMin;
  const o2NeedMlPerMin=SOURCE_CONSTANTS.calToO2*totalCalsUsed;

  const out={
    basalCalsUsed,
    totalCalsUsed,
    o2NeedMlPerMin,
  };
  if(o2UseMlPerMin!=null){
    const o2LackMlPerMin=o2NeedMlPerMin-o2UseMlPerMin;
    out.o2LackMlPerMin=o2LackMlPerMin;
    out.aerobicCalsPerMin=SOURCE_CONSTANTS.o2ToCal*o2UseMlPerMin;
    out.anaerobicCalsPerMin=SOURCE_CONSTANTS.o2ToCal*o2LackMlPerMin;
  }

  return Object.freeze({
    ...out,
    provenance:Object.freeze({
      status:'source-aligned',
      sourceRepository:HUMMOD_SOURCE_IDENTITY.canonicalRepository,
      sourceRevision:HUMMOD_SOURCE_IDENTITY.canonicalRevision,
      sourceStructure:'SkeletalMuscle-Metabolism',
      clinicalValidation:false,
    }),
  });
}

module.exports={SOURCE_CONSTANTS,skeletalMuscleMetabolism};
