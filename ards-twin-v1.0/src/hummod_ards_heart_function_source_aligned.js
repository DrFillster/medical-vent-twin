'use strict';

// Source-aligned HumMod myocardial function and asystole logic for v1.3.
// Canonical source: HumMod/hummod-standalone.
// Reproducibility mirror: riliescu/hummod-standalone@8dab57e05631f779bf5020fe0dd51874d8ae98c1
//
// Exact source relations preserved here:
// - LeftHeart-Function / RightHeart-Function pH, protein, fuel, and temperature curves
// - Effect = PhEffect * ProteinEffect * FuelEffect * TemperatureEffect * StructureEffect
// - failure latch: Effect < 0.2
// - recovery latch: Effect > 0.4
// - Heart-Asystole.Is_Asystole = LeftHeart-Function.Failed
//
// This module intentionally requires local myocardial state. It must not be
// driven from arterial pH as a substitute for LeftHeart-Ph.Ph/RightHeart-Ph.Ph.

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite');
  return v;
}
function positive(v,label){ finite(v,label); if(!(v>0)) throw new Error(label+' must be > 0'); return v; }

function hermite(points,x){
  finite(x,'curve input');
  if(!Array.isArray(points)||points.length<2) throw new Error('curve requires >= 2 points');
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

const CURVES=Object.freeze({
  ph:Object.freeze([
    Object.freeze({x:6.6,y:0,slope:0}),
    Object.freeze({x:6.7,y:1,slope:0}),
  ]),
  protein:Object.freeze([
    Object.freeze({x:3000,y:0,slope:0}),
    Object.freeze({x:5200,y:1,slope:0}),
  ]),
  fuel:Object.freeze([
    Object.freeze({x:0,y:0,slope:0}),
    Object.freeze({x:0.9,y:1,slope:0}),
  ]),
  temperature:Object.freeze([
    Object.freeze({x:10,y:0,slope:0}),
    Object.freeze({x:37,y:1,slope:0.12}),
    Object.freeze({x:40,y:1.5,slope:0}),
    Object.freeze({x:46,y:0,slope:0}),
  ]),
});

const FAILURE_EFFECT_THRESHOLD=0.2;
const RECOVERY_EFFECT_THRESHOLD=0.4;

function calculateSide({
  myocardialPh,
  cellProteinMassG=5200,
  fuelFractUseDelay=0.9,
  coreTempC=37,
  structureEffect=1,
}={}){
  finite(myocardialPh,'myocardialPh');
  positive(cellProteinMassG,'cellProteinMassG');
  finite(fuelFractUseDelay,'fuelFractUseDelay');
  finite(coreTempC,'coreTempC');
  finite(structureEffect,'structureEffect');

  const phEffect=hermite(CURVES.ph,myocardialPh);
  const proteinEffect=hermite(CURVES.protein,cellProteinMassG);
  const fuelEffect=hermite(CURVES.fuel,fuelFractUseDelay);
  const temperatureEffect=hermite(CURVES.temperature,coreTempC);
  const effect=phEffect*proteinEffect*fuelEffect*temperatureEffect*structureEffect;
  return Object.freeze({
    myocardialPh,
    cellProteinMassG,
    fuelFractUseDelay,
    coreTempC,
    structureEffect,
    phEffect,
    proteinEffect,
    fuelEffect,
    temperatureEffect,
    effect,
  });
}

function updateFailureLatch(priorFailed,effect){
  finite(effect,'effect');
  if(!priorFailed && effect<FAILURE_EFFECT_THRESHOLD) return true;
  if(priorFailed && effect>RECOVERY_EFFECT_THRESHOLD) return false;
  return Boolean(priorFailed);
}

function createHumModSourceAlignedHeartFunction(){
  let leftFailed=false;
  let rightFailed=false;
  let last=null;

  function step({left,right}={}){
    if(!left||!right) throw new Error('left and right local myocardial state are required');
    const leftState=calculateSide(left);
    const rightState=calculateSide(right);
    leftFailed=updateFailureLatch(leftFailed,leftState.effect);
    rightFailed=updateFailureLatch(rightFailed,rightState.effect);
    const isAsystole=leftFailed;
    last=Object.freeze({
      left:Object.freeze({...leftState,failed:leftFailed}),
      right:Object.freeze({...rightState,failed:rightFailed}),
      isAsystole,
      provenance:Object.freeze({
        status:'source-aligned-myocardial-function-subset',
        sourceRepository:'HumMod/hummod-standalone',
        reproducibilityMirrorRepository:'riliescu/hummod-standalone',
        reproducibilityMirrorRevision:'8dab57e05631f779bf5020fe0dd51874d8ae98c1',
        arterialPhSubstitutionAllowed:false,
      }),
    });
    return snapshot();
  }

  function snapshot(){
    return Object.freeze(last||{
      left:Object.freeze({failed:leftFailed}),
      right:Object.freeze({failed:rightFailed}),
      isAsystole:leftFailed,
      provenance:Object.freeze({
        status:'source-aligned-myocardial-function-subset',
        sourceRepository:'HumMod/hummod-standalone',
        reproducibilityMirrorRepository:'riliescu/hummod-standalone',
        reproducibilityMirrorRevision:'8dab57e05631f779bf5020fe0dd51874d8ae98c1',
        arterialPhSubstitutionAllowed:false,
      }),
    });
  }

  return Object.freeze({kind:'hummod-source-aligned-heart-function',step,snapshot});
}

module.exports={
  CURVES,
  FAILURE_EFFECT_THRESHOLD,
  RECOVERY_EFFECT_THRESHOLD,
  hermite,
  calculateSide,
  updateFailureLatch,
  createHumModSourceAlignedHeartFunction,
};
