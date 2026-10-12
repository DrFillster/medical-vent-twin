'use strict';

/**
 * HumMod source-aligned acute Brain-Fuel candidate.
 *
 * Pinned source:
 * riliescu/hummod-standalone@8dab57e05631f779bf5020fe0dd51874d8ae98c1
 *
 * Source files:
 * - Structure/Brain/Brain-Metabolism.DES
 * - Structure/Brain/Brain-Fuel.DES
 * - Structure/Brain/Brain-Flow.DES
 * - Structure/Metabolism/Metabolism-Tools.DES
 *
 * This module does NOT invent substrate concentrations. Glucose, ketoacid,
 * lactate, and plasma-flow boundaries must be supplied explicitly.
 */

const SOURCE=Object.freeze({
  repository:'riliescu/hummod-standalone',
  revision:'8dab57e05631f779bf5020fe0dd51874d8ae98c1',
  authority:'candidate-not-canonical',
});

const P=Object.freeze({
  calToO2:0.2093,
  o2ToCal:4.778,
  carboAerobicMgPerCal:0.2439,
  carboAnaerobicMgPerCal:6.3411,
  fatMgPerCal:0.1075,
  lactateMgPerCal:0.2538,
  ketoacidRatioConstant:0.222,
  fractUseDelayKPerMin:0.5,
});

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

const LAC_FRACTION=Object.freeze([
  Object.freeze({x:10,y:0,slope:0}),
  Object.freeze({x:100,y:0.3,slope:0}),
]);

function brainMetabolismFromO2({
  o2NeedMlPerMin,
  o2UseMlPerMin,
}={}){
  positive(o2NeedMlPerMin,'o2NeedMlPerMin');
  nonNegative(o2UseMlPerMin,'o2UseMlPerMin');
  const o2LackMlPerMin=o2NeedMlPerMin-o2UseMlPerMin;
  const aerobicCalsPerMin=P.o2ToCal*o2UseMlPerMin;
  const anaerobicCalsPerMin=P.o2ToCal*o2LackMlPerMin;
  return Object.freeze({
    o2NeedMlPerMin,
    o2UseMlPerMin,
    o2LackMlPerMin,
    aerobicCalsPerMin,
    anaerobicCalsPerMin,
  });
}

function brainFuelState({
  plasmaFlowMlPerMin,
  glucoseMgPerMl,
  ketoacidMgPerMl,
  lactateMgPerDl,
  aerobicCalsPerMin,
  anaerobicCalsPerMin,
}={}){
  nonNegative(plasmaFlowMlPerMin,'plasmaFlowMlPerMin');
  nonNegative(glucoseMgPerMl,'glucoseMgPerMl');
  nonNegative(ketoacidMgPerMl,'ketoacidMgPerMl');
  nonNegative(lactateMgPerDl,'lactateMgPerDl');
  nonNegative(aerobicCalsPerMin,'aerobicCalsPerMin');
  nonNegative(anaerobicCalsPerMin,'anaerobicCalsPerMin');

  const kaDeliveredMgPerMin=ketoacidMgPerMl*plasmaFlowMlPerMin;
  const glucoseDeliveredMgPerMin=glucoseMgPerMl*plasmaFlowMlPerMin;

  const lactateFraction=hermite(LAC_FRACTION,lactateMgPerDl);
  const kaPlusGlucoseFraction=1-lactateFraction;

  const glucoseMgPerDl=100*glucoseMgPerMl;
  const ketoacidMgPerDl=100*ketoacidMgPerMl;
  const ratio=glucoseMgPerDl>0
    ? ketoacidMgPerDl/glucoseMgPerDl
    : (ketoacidMgPerDl>0?Infinity:0);

  const kaFraction=Number.isFinite(ratio)
    ? kaPlusGlucoseFraction*(ratio/(ratio+P.ketoacidRatioConstant))
    : kaPlusGlucoseFraction;
  const glucoseFraction=kaPlusGlucoseFraction-kaFraction;

  const kaUsedCalPerMin=kaFraction*aerobicCalsPerMin;
  const kaUsedMgPerMin=kaUsedCalPerMin*P.fatMgPerCal;

  const aerobicGlucoseUsedCalPerMin=glucoseFraction*aerobicCalsPerMin;
  const aerobicGlucoseUsedMgPerMin=
    aerobicGlucoseUsedCalPerMin*P.carboAerobicMgPerCal;

  const lactateUsedCalPerMin=lactateFraction*aerobicCalsPerMin;
  const lactateUsedMgPerMin=lactateUsedCalPerMin*P.lactateMgPerCal;

  const anaerobicGlucoseDeliveredMgPerMin=
    glucoseDeliveredMgPerMin-aerobicGlucoseUsedMgPerMin;
  // Exact HumMod Brain-Fuel.DES transcription:
  // AnaerobicGlucoseUsed(Cal/Min) =
  //   Brain-Metabolism.AnaerobicCals MIN AnaerobicGlucoseDelivered
  // where AnaerobicGlucoseDelivered is carried in mg/min in the source.
  // This is dimensionally unusual, but it is reproduced rather than
  // silently repaired.
  const anaerobicGlucoseUsedCalPerMin=Math.min(
    anaerobicCalsPerMin,
    Math.max(anaerobicGlucoseDeliveredMgPerMin,0)
  );
  const anaerobicGlucoseUsedMgPerMin=
    anaerobicGlucoseUsedCalPerMin*P.carboAnaerobicMgPerCal;

  const kaFractionalDelivery=kaUsedMgPerMin>0
    ?Math.min(kaDeliveredMgPerMin/kaUsedMgPerMin,1):1;
  const aerobicGlucoseFractionalDelivery=aerobicGlucoseUsedMgPerMin>0
    ?Math.min(glucoseDeliveredMgPerMin/aerobicGlucoseUsedMgPerMin,1):1;
  const anaerobicGlucoseFractionalDelivery=anaerobicGlucoseUsedMgPerMin>0
    ?Math.min(
      Math.max(anaerobicGlucoseDeliveredMgPerMin,0)/
        anaerobicGlucoseUsedMgPerMin,
      1
    ):1;

  const minimumFractionalDelivery=Math.min(
    kaFractionalDelivery,
    aerobicGlucoseFractionalDelivery,
    anaerobicGlucoseFractionalDelivery
  );

  return Object.freeze({
    kaDeliveredMgPerMin,
    glucoseDeliveredMgPerMin,
    lactateFraction,
    kaFraction,
    glucoseFraction,
    kaUsedMgPerMin,
    aerobicGlucoseUsedMgPerMin,
    lactateUsedMgPerMin,
    anaerobicGlucoseDeliveredMgPerMin,
    anaerobicGlucoseUsedMgPerMin,
    kaFractionalDelivery,
    aerobicGlucoseFractionalDelivery,
    anaerobicGlucoseFractionalDelivery,
    minimumFractionalDelivery,
    fractUse:minimumFractionalDelivery,
  });
}

function createHumModBrainFuelCandidate({
  initialFractUseDelay=1,
}={}){
  nonNegative(initialFractUseDelay,'initialFractUseDelay');
  let fractUseDelay=initialFractUseDelay;
  let last=null;

  function step({
    dtSec,
    plasmaFlowMlPerMin,
    glucoseMgPerMl,
    ketoacidMgPerMl,
    lactateMgPerDl,
    o2NeedMlPerMin,
    o2UseMlPerMin,
  }={}){
    positive(dtSec,'dtSec');

    const metabolism=brainMetabolismFromO2({
      o2NeedMlPerMin,
      o2UseMlPerMin,
    });
    const fuel=brainFuelState({
      plasmaFlowMlPerMin,
      glucoseMgPerMl,
      ketoacidMgPerMl,
      lactateMgPerDl,
      aerobicCalsPerMin:metabolism.aerobicCalsPerMin,
      anaerobicCalsPerMin:metabolism.anaerobicCalsPerMin,
    });

    // HumMod StableDelay: K = 0.5 /min.
    const dtMin=dtSec/60;
    const alpha=1-Math.exp(-P.fractUseDelayKPerMin*dtMin);
    fractUseDelay+=alpha*(fuel.fractUse-fractUseDelay);

    last=Object.freeze({
      schema:'hummod-brain-fuel-candidate/v1',
      authority:SOURCE.authority,
      canonicalControlAuthority:false,
      metabolism,
      fuel,
      fractUseDelay,
      provenance:SOURCE,
    });
    return last;
  }

  return Object.freeze({
    step,
    snapshot:()=>last||Object.freeze({
      schema:'hummod-brain-fuel-candidate/v1',
      authority:SOURCE.authority,
      canonicalControlAuthority:false,
      fractUseDelay,
      provenance:SOURCE,
    }),
  });
}

module.exports=Object.freeze({
  SOURCE,P,LAC_FRACTION,hermite,
  brainMetabolismFromO2,
  brainFuelState,
  createHumModBrainFuelCandidate,
});
