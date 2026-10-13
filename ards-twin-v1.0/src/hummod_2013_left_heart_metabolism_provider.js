'use strict';

/**
 * HumMod 2012/2013 left-heart metabolic O2-demand provider.
 *
 * Source:
 * nysuloem/HumMod-UTSC-CPG@93ee1b30b74a0f2e60a2c961bbf569b4c8237611
 * - Structure/LeftHeart/LeftHeart-Metabolism.DES
 * - Structure/LeftHeart/LeftHeart-Work.DES
 * - Structure/Metabolism/Metabolism-Tools.DES
 *
 * This module computes demand only. O2Use remains owned by LeftHeart-Flow.
 */

const SOURCE=Object.freeze({
  repository:'nysuloem/HumMod-UTSC-CPG',
  revision:'93ee1b30b74a0f2e60a2c961bbf569b4c8237611',
  files:Object.freeze([
    'Structure/LeftHeart/LeftHeart-Metabolism.DES',
    'Structure/LeftHeart/LeftHeart-Work.DES',
    'Structure/Metabolism/Metabolism-Tools.DES',
  ]),
  authority:'candidate-not-canonical',
});

const BASAL_CALS_PER_MIN_PER_G=0.0669;
const WORK_MOTION_CALS_PER_MIN=24;
const WORK_HEAT_CALS_PER_MIN=87;
const WORK_TOTAL_CALS_PER_MIN=111;
const CAL_TO_O2_ML_PER_CAL=0.2093;

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

function leftHeartO2Demand2013({
  myocardialMassG,
  initialMyocardialMassG,
  calMultiplier=1,
  thyroidEffect,
  heatMetabolismCore,
  structureEffect,
}={}){
  positive(myocardialMassG,'myocardialMassG');
  positive(initialMyocardialMassG,'initialMyocardialMassG');
  nonNegative(calMultiplier,'calMultiplier');
  nonNegative(thyroidEffect,'thyroidEffect');
  nonNegative(heatMetabolismCore,'heatMetabolismCore');
  nonNegative(structureEffect,'structureEffect');

  const initialBasalCalsUsed=
    calMultiplier*BASAL_CALS_PER_MIN_PER_G*initialMyocardialMassG;
  const basalCalsUsed=
    calMultiplier*BASAL_CALS_PER_MIN_PER_G*myocardialMassG;
  const totalCalsUsed=
    (basalCalsUsed*thyroidEffect*heatMetabolismCore*structureEffect)+
    WORK_TOTAL_CALS_PER_MIN;
  const o2NeedMlPerMin=CAL_TO_O2_ML_PER_CAL*totalCalsUsed;

  return Object.freeze({
    schema:'hummod-2013-left-heart-o2-demand/v1',
    myocardialMassG,
    initialMyocardialMassG,
    calMultiplier,
    thyroidEffect,
    heatMetabolismCore,
    structureEffect,
    initialBasalCalsUsed,
    basalCalsUsed,
    work:Object.freeze({
      motionCalsPerMin:WORK_MOTION_CALS_PER_MIN,
      heatCalsPerMin:WORK_HEAT_CALS_PER_MIN,
      totalCalsPerMin:WORK_TOTAL_CALS_PER_MIN,
    }),
    totalCalsUsed,
    o2NeedMlPerMin,
    controlAuthority:false,
    provenance:SOURCE,
  });
}

module.exports=Object.freeze({
  SOURCE,
  BASAL_CALS_PER_MIN_PER_G,
  WORK_MOTION_CALS_PER_MIN,
  WORK_HEAT_CALS_PER_MIN,
  WORK_TOTAL_CALS_PER_MIN,
  CAL_TO_O2_ML_PER_CAL,
  leftHeartO2Demand2013,
});
