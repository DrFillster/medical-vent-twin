'use strict';

// Exact source-aligned HumMod myocardial metabolism primitive.
// Pinned source:
// riliescu/hummod-standalone@8dab57e05631f779bf5020fe0dd51874d8ae98c1
// Structure/LeftHeart/LeftHeart-Metabolism.DES
// Structure/RightHeart/RightHeart-Metabolism.DES
// Structure/LeftHeart/LeftHeart-Work.DES
// Structure/RightHeart/RightHeart-Work.DES
// Structure/Metabolism/Metabolism-Tools.DES

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite');
  return v;
}
function nonNegative(v,label){
  finite(v,label);
  if(v<0) throw new Error(label+' must be >= 0');
  return v;
}
function positive(v,label){
  finite(v,label);
  if(!(v>0)) throw new Error(label+' must be > 0');
  return v;
}

const HEART_BASAL_CALS_USED_PER_MIN_PER_G=Object.freeze({left:0.0669,right:0.0600});
const CAL_TO_O2=0.2093;
const O2_TO_CAL=4.778;
const HEART_WORK_CALS=Object.freeze({
  left:Object.freeze({motion:24,heat:87,total:111}),
  right:Object.freeze({motion:5,heat:17,total:22}),
});

function myocardialMetabolism({
  side,
  myocardialMassG,
  initialMyocardialMassG=myocardialMassG,
  calMultiplier=1,
  thyroidEffect=1,
  heatMetabolismCore=1,
  structureEffect=1,
  o2UseMlPerMin,
}={}){
  if(side!=='left'&&side!=='right') throw new Error('side must be left or right');
  positive(myocardialMassG,'myocardialMassG');
  positive(initialMyocardialMassG,'initialMyocardialMassG');
  nonNegative(calMultiplier,'calMultiplier');
  nonNegative(thyroidEffect,'thyroidEffect');
  nonNegative(heatMetabolismCore,'heatMetabolismCore');
  nonNegative(structureEffect,'structureEffect');
  nonNegative(o2UseMlPerMin,'o2UseMlPerMin');

  const initialBasalCalsUsed=
    calMultiplier*HEART_BASAL_CALS_USED_PER_MIN_PER_G[side]*initialMyocardialMassG;
  const basalCalsUsed=
    calMultiplier*HEART_BASAL_CALS_USED_PER_MIN_PER_G[side]*myocardialMassG;
  const work=HEART_WORK_CALS[side];
  const totalCalsUsed=
    (basalCalsUsed*thyroidEffect*heatMetabolismCore*structureEffect)+work.total;
  const o2NeedMlPerMin=CAL_TO_O2*totalCalsUsed;
  const o2LackMlPerMin=o2NeedMlPerMin-o2UseMlPerMin;
  const aerobicCals=O2_TO_CAL*o2UseMlPerMin;
  const anaerobicCals=O2_TO_CAL*o2LackMlPerMin;

  return Object.freeze({
    side,
    myocardialMassG,
    initialMyocardialMassG,
    calMultiplier,
    initialBasalCalsUsed,
    basalCalsUsed,
    work,
    totalCalsUsed,
    o2NeedMlPerMin,
    o2UseMlPerMin,
    o2LackMlPerMin,
    aerobicCals,
    anaerobicCals,
    source:Object.freeze({
      basalCalsUsedPerMinPerG:HEART_BASAL_CALS_USED_PER_MIN_PER_G[side],
      calToO2:CAL_TO_O2,
      o2ToCal:O2_TO_CAL,
    }),
  });
}

module.exports={
  HEART_BASAL_CALS_USED_PER_MIN_PER_G,
  CAL_TO_O2,
  O2_TO_CAL,
  HEART_WORK_CALS,
  myocardialMetabolism,
};
