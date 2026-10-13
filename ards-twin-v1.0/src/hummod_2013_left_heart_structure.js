'use strict';

/**
 * HumMod 2012/2013 LeftHeart-Structure state.
 *
 * Source:
 * nysuloem/HumMod-UTSC-CPG@93ee1b30b74a0f2e60a2c961bbf569b4c8237611
 * Structure/LeftHeart/LeftHeart-Structure.DES
 *
 * HumMod backwardeuler semantics are inferred from source pool equations:
 * dy/dt = F1 - F2*y
 * y_new = (y_old + dt*F1)/(1 + dt*F2)
 *
 * For LeftHeart-Structure: F1=0 and
 * F2 = PhEffect + TemperatureEffect + FuelEffect.
 *
 * HumMod timebase is minutes.
 */

const SOURCE=Object.freeze({
  repository:'nysuloem/HumMod-UTSC-CPG',
  revision:'93ee1b30b74a0f2e60a2c961bbf569b4c8237611',
  file:'Structure/LeftHeart/LeftHeart-Structure.DES',
  authority:'candidate-not-canonical',
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

const PH_ON_STRUCTURE=Object.freeze([
  Object.freeze({x:6.5,y:0.1,slope:0}),
  Object.freeze({x:6.6,y:0.0,slope:0}),
]);
const FUEL_ON_STRUCTURE=Object.freeze([
  Object.freeze({x:0.0,y:0.05,slope:0}),
  Object.freeze({x:0.3,y:0.0,slope:0}),
]);
const TEMPERATURE_ON_STRUCTURE=Object.freeze([
  Object.freeze({x:44.0,y:0.0,slope:0}),
  Object.freeze({x:46.0,y:0.05,slope:0}),
]);

function createHumMod2013LeftHeartStructure({
  initialEffect=1,
}={}){
  nonNegative(initialEffect,'initialEffect');
  let effect=initialEffect;
  let timeSec=0;
  let last=null;

  function step({
    dtSec,
    myocardialIntracellularPh,
    fuelFractUseDelay,
    coreTempC,
  }={}){
    positive(dtSec,'dtSec');
    finite(myocardialIntracellularPh,'myocardialIntracellularPh');
    finite(fuelFractUseDelay,'fuelFractUseDelay');
    finite(coreTempC,'coreTempC');

    const phEffect=hermite(PH_ON_STRUCTURE,myocardialIntracellularPh);
    const fuelEffect=hermite(FUEL_ON_STRUCTURE,fuelFractUseDelay);
    const temperatureEffect=hermite(TEMPERATURE_ON_STRUCTURE,coreTempC);
    const f1=0;
    const f2=phEffect+fuelEffect+temperatureEffect;
    const dtMin=dtSec/60;

    effect=(effect+(dtMin*f1))/(1+(dtMin*f2));
    timeSec+=dtSec;

    last=Object.freeze({
      schema:'hummod-2013-left-heart-structure/v1',
      timeSec,
      effect,
      phEffect,
      fuelEffect,
      temperatureEffect,
      f1,
      f2,
      dtMin,
      backwardEulerForm:'y_new=(y_old+dt*F1)/(1+dt*F2)',
      controlAuthority:false,
      provenance:SOURCE,
    });
    return last;
  }

  function snapshot(){
    return last||Object.freeze({
      schema:'hummod-2013-left-heart-structure/v1',
      timeSec,
      effect,
      phEffect:null,
      fuelEffect:null,
      temperatureEffect:null,
      f1:null,
      f2:null,
      controlAuthority:false,
      provenance:SOURCE,
    });
  }

  return Object.freeze({step,snapshot});
}

module.exports=Object.freeze({
  SOURCE,
  PH_ON_STRUCTURE,
  FUEL_ON_STRUCTURE,
  TEMPERATURE_ON_STRUCTURE,
  hermite,
  createHumMod2013LeftHeartStructure,
});
