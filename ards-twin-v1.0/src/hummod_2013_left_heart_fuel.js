'use strict';

/**
 * HumMod 2012/2013 LeftHeart-Fuel candidate.
 *
 * Source:
 * nysuloem/HumMod-UTSC-CPG@93ee1b30b74a0f2e60a2c961bbf569b4c8237611
 * Structure/LeftHeart/LeftHeart-Fuel.DES (revised 2013-02-05)
 * Structure/Metabolism/Metabolism-Tools.DES
 *
 * Important source properties reproduced exactly:
 * - AnaerobicGlucoseUsed(Cals/Min) = 0.
 * - LacPool.[Lac-] is used directly in the source lactate-delivery expression
 *   despite the output being labelled mG/Min. This dimensional oddity is not
 *   silently repaired.
 *
 * FractUseDelay is the source StableDelay with K=0.5/min. The continuous
 * first-order equation is advanced with exact zero-order-hold exponential
 * integration; this is a numerical implementation choice, not a physiology
 * change.
 */

const SOURCE=Object.freeze({
  repository:'nysuloem/HumMod-UTSC-CPG',
  revision:'93ee1b30b74a0f2e60a2c961bbf569b4c8237611',
  file:'Structure/LeftHeart/LeftHeart-Fuel.DES',
  authority:'candidate-not-canonical',
});

const FA_AVAILABLE_PERCENT=70;
const LAC_AVAILABLE_PERCENT=50;
const LAC_DC=18;
const FRACT_USE_DELAY_K_PER_MIN=0.5;

const CARBO_CAL_PER_MG=4.10;
const FAT_CAL_PER_MG=9.3;
const LAC_CAL_PER_MG=3.94;

const FAT_MG_PER_CAL=0.1075;
const CARBO_AEROBIC_MG_PER_CAL=0.2439;
const CARBO_ANAEROBIC_MG_PER_CAL=6.3411;
const LAC_MG_PER_CAL=0.2538;

function sourceAnaerobicGlucoseUse2013(){
  return Object.freeze({
    anaerobicGlucoseUsedCalsPerMin:0,
    anaerobicGlucoseUsedMgPerMin:0,
    sourceStatement:'Exact 2013 LeftHeart-Fuel source: AnaerobicGlucoseUsed(Cals/Min) = 0.',
    controlAuthority:false,
    provenance:SOURCE,
  });
}

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

function hermite(points,x){
  finite(x,'curve input');
  if(x<=points[0].x) return points[0].y+points[0].slope*(x-points[0].x);
  const z=points[points.length-1];
  if(x>=z.x) return z.y+z.slope*(x-z.x);
  let i=0;
  while(i+1<points.length&&x>points[i+1].x)i++;
  const a=points[i],b=points[i+1],h=b.x-a.x,t=(x-a.x)/h;
  return (2*t*t*t-3*t*t+1)*a.y+
    (t*t*t-2*t*t+t)*h*a.slope+
    (-2*t*t*t+3*t*t)*b.y+
    (t*t*t-t*t)*h*b.slope;
}

const INSULIN_EFFECT=Object.freeze([
  Object.freeze({x:0,y:0.15,slope:0}),
  Object.freeze({x:8,y:0.50,slope:0.02}),
  Object.freeze({x:100,y:1.00,slope:0}),
]);

const FA_USED_FRACTION=Object.freeze([
  Object.freeze({x:0.0,y:0.0,slope:0}),
  Object.freeze({x:0.3,y:0.7,slope:1.4}),
  Object.freeze({x:1.0,y:1.0,slope:0}),
]);

function leftHeartFuelInstant2013({
  insulinReceptorBoundFractionPercent,
  glucosePoolMgPerMl,
  fattyAcidPoolMgPerMl,
  lactatePoolMeqPerMl,
  plasmaFlowMlPerMin,
  myocardialLactateMeqPerMl,
  aerobicCalsPerMin,
  totalCalsUsedPerMin,
  o2UseMlPerMin,
}={}){
  [
    ['insulinReceptorBoundFractionPercent',insulinReceptorBoundFractionPercent],
    ['glucosePoolMgPerMl',glucosePoolMgPerMl],
    ['fattyAcidPoolMgPerMl',fattyAcidPoolMgPerMl],
    ['lactatePoolMeqPerMl',lactatePoolMeqPerMl],
    ['plasmaFlowMlPerMin',plasmaFlowMlPerMin],
    ['myocardialLactateMeqPerMl',myocardialLactateMeqPerMl],
    ['aerobicCalsPerMin',aerobicCalsPerMin],
    ['totalCalsUsedPerMin',totalCalsUsedPerMin],
    ['o2UseMlPerMin',o2UseMlPerMin],
  ].forEach(([k,v])=>finite(v,k));
  nonNegative(insulinReceptorBoundFractionPercent,'insulinReceptorBoundFractionPercent');
  nonNegative(glucosePoolMgPerMl,'glucosePoolMgPerMl');
  nonNegative(fattyAcidPoolMgPerMl,'fattyAcidPoolMgPerMl');
  nonNegative(lactatePoolMeqPerMl,'lactatePoolMeqPerMl');
  nonNegative(plasmaFlowMlPerMin,'plasmaFlowMlPerMin');
  nonNegative(myocardialLactateMeqPerMl,'myocardialLactateMeqPerMl');
  nonNegative(aerobicCalsPerMin,'aerobicCalsPerMin');
  positive(totalCalsUsedPerMin,'totalCalsUsedPerMin');
  nonNegative(o2UseMlPerMin,'o2UseMlPerMin');

  const isFailed=plasmaFlowMlPerMin<=0 || o2UseMlPerMin<=0;
  const insulinEffect=hermite(
    INSULIN_EFFECT,
    insulinReceptorBoundFractionPercent
  );
  const glucoseAvailablePercent=100*insulinEffect;

  if(isFailed){
    return Object.freeze({
      isFailed:true,
      insulinEffect,
      glucoseAvailablePercent,
      glucoseDeliveredMgPerMin:0,
      faDeliveredMgPerMin:0,
      lacDeliveredSourceUnitsPerMin:0,
      glucoseDeliveredCalsPerMin:0,
      faDeliveredCalsPerMin:0,
      lacDeliveredCalsPerMin:0,
      totalDeliveredCalsPerMin:0,
      lacGradientMeqPerMl:0,
      lacUsedCalsPerMin:0,
      faDeliveredFraction:null,
      faUsedFraction:null,
      faUsedCalsPerMin:0,
      aerobicGlucoseUsedCalsPerMin:0,
      anaerobicGlucoseUsedCalsPerMin:0,
      totalGlucoseUsedCalsPerMin:0,
      totalUsedCalsPerMin:0,
      adequacy:0,
      glucosePercent:null,
      fatPercent:null,
      lactatePercent:null,
      totalPercent:null,
      faUsedMgPerMin:0,
      aerobicGlucoseUsedMgPerMin:0,
      anaerobicGlucoseUsedMgPerMin:0,
      lacUsedMgPerMin:0,
      totalGlucoseUsedMgPerMin:0,
      provenance:SOURCE,
    });
  }

  const glucoseDeliveredMgPerMin=
    0.01*glucoseAvailablePercent*glucosePoolMgPerMl*plasmaFlowMlPerMin;
  const faDeliveredMgPerMin=
    0.01*FA_AVAILABLE_PERCENT*fattyAcidPoolMgPerMl*plasmaFlowMlPerMin;

  // Exact source transcription. Lactate concentration is mEq/mL in LacPool,
  // yet the source labels this delivery variable mG/Min.
  const lacDeliveredSourceUnitsPerMin=
    0.01*LAC_AVAILABLE_PERCENT*lactatePoolMeqPerMl*plasmaFlowMlPerMin;

  const glucoseDeliveredCalsPerMin=
    CARBO_CAL_PER_MG*glucoseDeliveredMgPerMin;
  const faDeliveredCalsPerMin=
    FAT_CAL_PER_MG*faDeliveredMgPerMin;
  const lacDeliveredCalsPerMin=
    LAC_CAL_PER_MG*lacDeliveredSourceUnitsPerMin;
  const totalDeliveredCalsPerMin=
    glucoseDeliveredCalsPerMin+
    faDeliveredCalsPerMin+
    lacDeliveredCalsPerMin;

  const lacGradientMeqPerMl=Math.max(
    lactatePoolMeqPerMl-myocardialLactateMeqPerMl,
    0
  );
  const lacUsedCalsPerMin=Math.min(
    lacGradientMeqPerMl*LAC_DC,
    lacDeliveredCalsPerMin
  );

  if(!(totalDeliveredCalsPerMin>0)){
    throw new Error(
      'HumMod LeftHeart-Fuel source is undefined for positive flow/O2Use with zero TotalDelivered(Cals/Min)'
    );
  }

  const faDeliveredFraction=
    faDeliveredCalsPerMin/totalDeliveredCalsPerMin;
  const faUsedFraction=hermite(
    FA_USED_FRACTION,
    faDeliveredFraction
  );
  const faUsedCalsPerMin=Math.min(
    faUsedFraction*aerobicCalsPerMin,
    faDeliveredCalsPerMin
  );
  const aerobicGlucoseUsedCalsPerMin=Math.min(
    aerobicCalsPerMin-(faUsedCalsPerMin+lacUsedCalsPerMin),
    glucoseDeliveredCalsPerMin
  );

  // Exact 2013 source: no anaerobic glucose use in LeftHeart-Fuel.
  const sourceAnaerobic=sourceAnaerobicGlucoseUse2013();
  const anaerobicGlucoseUsedCalsPerMin=
    sourceAnaerobic.anaerobicGlucoseUsedCalsPerMin;
  const totalGlucoseUsedCalsPerMin=
    aerobicGlucoseUsedCalsPerMin+anaerobicGlucoseUsedCalsPerMin;
  const totalUsedCalsPerMin=
    totalGlucoseUsedCalsPerMin+faUsedCalsPerMin+lacUsedCalsPerMin;
  const adequacy=totalUsedCalsPerMin/totalCalsUsedPerMin;

  const glucosePercent=totalUsedCalsPerMin!==0
    ?100*totalGlucoseUsedCalsPerMin/totalUsedCalsPerMin:null;
  const fatPercent=totalUsedCalsPerMin!==0
    ?100*faUsedCalsPerMin/totalUsedCalsPerMin:null;
  const lactatePercent=totalUsedCalsPerMin!==0
    ?100*lacUsedCalsPerMin/totalUsedCalsPerMin:null;
  const totalPercent=
    glucosePercent==null?null:(glucosePercent+fatPercent+lactatePercent);

  const faUsedMgPerMin=faUsedCalsPerMin*FAT_MG_PER_CAL;
  const aerobicGlucoseUsedMgPerMin=
    aerobicGlucoseUsedCalsPerMin*CARBO_AEROBIC_MG_PER_CAL;
  const lacUsedMgPerMin=lacUsedCalsPerMin*LAC_MG_PER_CAL;
  const anaerobicGlucoseUsedMgPerMin=
    sourceAnaerobic.anaerobicGlucoseUsedMgPerMin;
  const totalGlucoseUsedMgPerMin=
    aerobicGlucoseUsedMgPerMin+anaerobicGlucoseUsedMgPerMin;

  return Object.freeze({
    isFailed:false,
    insulinEffect,
    glucoseAvailablePercent,
    glucoseDeliveredMgPerMin,
    faDeliveredMgPerMin,
    lacDeliveredSourceUnitsPerMin,
    glucoseDeliveredCalsPerMin,
    faDeliveredCalsPerMin,
    lacDeliveredCalsPerMin,
    totalDeliveredCalsPerMin,
    lacGradientMeqPerMl,
    lacUsedCalsPerMin,
    faDeliveredFraction,
    faUsedFraction,
    faUsedCalsPerMin,
    aerobicGlucoseUsedCalsPerMin,
    anaerobicGlucoseUsedCalsPerMin,
    totalGlucoseUsedCalsPerMin,
    totalUsedCalsPerMin,
    adequacy,
    glucosePercent,
    fatPercent,
    lactatePercent,
    totalPercent,
    faUsedMgPerMin,
    aerobicGlucoseUsedMgPerMin,
    anaerobicGlucoseUsedMgPerMin,
    lacUsedMgPerMin,
    totalGlucoseUsedMgPerMin,
    provenance:SOURCE,
  });
}

function createHumMod2013LeftHeartFuel({
  initialFractUseDelay=1,
}={}){
  nonNegative(initialFractUseDelay,'initialFractUseDelay');
  let fractUseDelay=initialFractUseDelay;
  let last=null;

  function step({dtSec,...inputs}={}){
    positive(dtSec,'dtSec');
    const fuel=leftHeartFuelInstant2013(inputs);
    const dtMin=dtSec/60;
    const alpha=1-Math.exp(-FRACT_USE_DELAY_K_PER_MIN*dtMin);
    fractUseDelay+=alpha*(fuel.adequacy-fractUseDelay);

    last=Object.freeze({
      schema:'hummod-2013-left-heart-fuel/v1',
      authority:SOURCE.authority,
      canonicalControlAuthority:false,
      ...fuel,
      fractUseDelay,
      numericalImplementation:Object.freeze({
        stableDelay:'exact-ZOH integration of source first-order K=0.5/min delay',
        exactDesIntegratorIdentity:false,
      }),
      controlAuthority:false,
      provenance:SOURCE,
    });
    return last;
  }

  return Object.freeze({
    step,
    snapshot:()=>last||Object.freeze({
      schema:'hummod-2013-left-heart-fuel/v1',
      authority:SOURCE.authority,
      canonicalControlAuthority:false,
      fractUseDelay,
      controlAuthority:false,
      provenance:SOURCE,
    }),
  });
}

module.exports=Object.freeze({
  SOURCE,
  FA_AVAILABLE_PERCENT,
  LAC_AVAILABLE_PERCENT,
  LAC_DC,
  FRACT_USE_DELAY_K_PER_MIN,
  CARBO_CAL_PER_MG,
  FAT_CAL_PER_MG,
  LAC_CAL_PER_MG,
  FAT_MG_PER_CAL,
  CARBO_AEROBIC_MG_PER_CAL,
  CARBO_ANAEROBIC_MG_PER_CAL,
  LAC_MG_PER_CAL,
  sourceAnaerobicGlucoseUse2013,
  INSULIN_EFFECT,
  FA_USED_FRACTION,
  hermite,
  leftHeartFuelInstant2013,
  createHumMod2013LeftHeartFuel,
});
