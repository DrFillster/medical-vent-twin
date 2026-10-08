'use strict';

// Exact source-aligned HumMod myocardial fuel-selection algebra.
// Pinned source:
// riliescu/hummod-standalone@8dab57e05631f779bf5020fe0dd51874d8ae98c1
// Structure/LeftHeart/LeftHeart-Fuel.DES
// Structure/RightHeart/RightHeart-Fuel.DES
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

function hermite(points,x){
  finite(x,'curve input');
  if(x<=points[0].x) return points[0].y + points[0].slope*(x-points[0].x);
  const last=points[points.length-1];
  if(x>=last.x) return last.y + last.slope*(x-last.x);
  let i=0;
  while(i+1<points.length && x>points[i+1].x) i++;
  const a=points[i], b=points[i+1];
  const h=b.x-a.x;
  const t=(x-a.x)/h;
  const h00=2*t*t*t-3*t*t+1;
  const h10=t*t*t-2*t*t+t;
  const h01=-2*t*t*t+3*t*t;
  const h11=t*t*t-t*t;
  return h00*a.y+h10*h*a.slope+h01*b.y+h11*h*b.slope;
}

const KR=0.026;
const CARBO_AEROBIC_MG_PER_CAL=0.2439;
const CARBO_ANAEROBIC_MG_PER_CAL=6.3411;
const FAT_MG_PER_CAL=0.1075;
const LACTATE_MG_PER_CAL=0.2538;

const LAC_FRACTION_CURVE=Object.freeze([
  Object.freeze({x:10,y:0,slope:0}),
  Object.freeze({x:100,y:0.3,slope:0}),
]);

function myocardialFuelSelection({
  fattyAcidConcentrationMgPerMl,
  fattyAcidConcentrationMgDl,
  glucoseConcentrationMgPerMl,
  glucoseConcentrationMgDl,
  plasmaFlowMlPerMin,
  myocardialLactateMgDl,
  aerobicCals,
  anaerobicCals,
}={}){
  [
    ['fattyAcidConcentrationMgPerMl',fattyAcidConcentrationMgPerMl],
    ['fattyAcidConcentrationMgDl',fattyAcidConcentrationMgDl],
    ['glucoseConcentrationMgPerMl',glucoseConcentrationMgPerMl],
    ['glucoseConcentrationMgDl',glucoseConcentrationMgDl],
    ['plasmaFlowMlPerMin',plasmaFlowMlPerMin],
    ['myocardialLactateMgDl',myocardialLactateMgDl],
    ['aerobicCals',aerobicCals],
    ['anaerobicCals',anaerobicCals],
  ].forEach(([k,v])=>nonNegative(v,k));

  const faDelivered=Math.max(fattyAcidConcentrationMgPerMl*plasmaFlowMlPerMin,0);
  const glucoseDelivered=Math.max(glucoseConcentrationMgPerMl*plasmaFlowMlPerMin,0);
  const lacFraction=hermite(LAC_FRACTION_CURVE,myocardialLactateMgDl);
  const faGlucoseFraction=1-lacFraction;
  const ratio=fattyAcidConcentrationMgDl/glucoseConcentrationMgDl;
  const faFraction=faGlucoseFraction*(ratio/(ratio+KR));
  const glucoseFraction=faGlucoseFraction-faFraction;

  const faUsedCalPerMin=faFraction*aerobicCals;
  const faUsedMgPerMin=faUsedCalPerMin*FAT_MG_PER_CAL;
  const aerobicGlucoseUsedCalPerMin=glucoseFraction*aerobicCals;
  const aerobicGlucoseUsedMgPerMin=aerobicGlucoseUsedCalPerMin*CARBO_AEROBIC_MG_PER_CAL;
  const lacUsedCalPerMin=lacFraction*aerobicCals;
  const lacUsedMgPerMin=lacUsedCalPerMin*LACTATE_MG_PER_CAL;
  const anaerobicGlucoseDelivered=glucoseDelivered-aerobicGlucoseUsedMgPerMin;
  const anaerobicGlucoseUsedCalPerMin=Math.min(anaerobicCals,anaerobicGlucoseDelivered);
  const anaerobicGlucoseUsedMgPerMin=
    anaerobicGlucoseUsedCalPerMin*CARBO_ANAEROBIC_MG_PER_CAL;
  const totalGlucoseUsedMgPerMin=
    aerobicGlucoseUsedMgPerMin+anaerobicGlucoseUsedMgPerMin;

  const faFractionalDelivery=faUsedMgPerMin>0
    ? Math.min(faDelivered/faUsedMgPerMin,1)
    : 1;
  const aerobicGlucoseFractionalDelivery=aerobicGlucoseUsedMgPerMin>0
    ? Math.min(glucoseDelivered/aerobicGlucoseUsedMgPerMin,1)
    : 1;
  const anaerobicGlucoseFractionalDelivery=anaerobicGlucoseUsedMgPerMin>0
    ? Math.min(anaerobicGlucoseDelivered/anaerobicGlucoseUsedMgPerMin,1)
    : 1;
  const minimumFractionalDelivery=Math.min(
    faFractionalDelivery,
    aerobicGlucoseFractionalDelivery,
    anaerobicGlucoseFractionalDelivery
  );

  return Object.freeze({
    faDelivered,
    glucoseDelivered,
    lacFraction,
    faGlucoseFraction,
    ratio,
    faFraction,
    glucoseFraction,
    faUsedCalPerMin,
    faUsedMgPerMin,
    aerobicGlucoseUsedCalPerMin,
    aerobicGlucoseUsedMgPerMin,
    lacUsedCalPerMin,
    lacUsedMgPerMin,
    anaerobicGlucoseDelivered,
    anaerobicGlucoseUsedCalPerMin,
    anaerobicGlucoseUsedMgPerMin,
    totalGlucoseUsedMgPerMin,
    faFractionalDelivery,
    aerobicGlucoseFractionalDelivery,
    anaerobicGlucoseFractionalDelivery,
    minimumFractionalDelivery,
  });
}

module.exports={
  KR,
  CARBO_AEROBIC_MG_PER_CAL,
  CARBO_ANAEROBIC_MG_PER_CAL,
  FAT_MG_PER_CAL,
  LACTATE_MG_PER_CAL,
  LAC_FRACTION_CURVE,
  hermite,
  myocardialFuelSelection,
};
