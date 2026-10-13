'use strict';

/**
 * HumMod 2012/2013 LeftHeart-Vasculature provider.
 *
 * Source:
 * nysuloem/HumMod-UTSC-CPG@93ee1b30b74a0f2e60a2c961bbf569b4c8237611
 * Structure/LeftHeart/LeftHeart-Vasculature.DES
 *
 * Source timebase is minutes.
 * Tau = 30 days; K = 1 / (30 * 1440) per minute.
 */

const SOURCE=Object.freeze({
  repository:'nysuloem/HumMod-UTSC-CPG',
  revision:'93ee1b30b74a0f2e60a2c961bbf569b4c8237611',
  file:'Structure/LeftHeart/LeftHeart-Vasculature.DES',
  authority:'candidate-not-canonical',
});

const TAU_DAYS=30;
const K_PER_MIN=1/(TAU_DAYS*1440);

const PO2_ON_STIMULUS=Object.freeze([
  Object.freeze({x:41,y:1.2,slope:0}),
  Object.freeze({x:51,y:1.0,slope:-0.03}),
  Object.freeze({x:61,y:0.8,slope:0}),
]);

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite');
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

function createHumMod2013LeftHeartVasculature({
  initialEffect=1,
}={}){
  finite(initialEffect,'initialEffect');
  let effect=initialEffect;
  let timeSec=0;

  function step({
    dtSec,
    myocardialPo2MmHg,
    leftHeartFunctionFailed=false,
  }={}){
    finite(dtSec,'dtSec');
    if(dtSec<0) throw new Error('dtSec must be >= 0');
    finite(myocardialPo2MmHg,'myocardialPo2MmHg');

    const stimulus=leftHeartFunctionFailed
      ?0
      :hermite(PO2_ON_STIMULUS,myocardialPo2MmHg);

    const dtMin=dtSec/60;
    const alpha=1-Math.exp(-K_PER_MIN*dtMin);
    effect=effect+alpha*(stimulus-effect);
    timeSec+=dtSec;

    return Object.freeze({
      schema:'hummod-2013-left-heart-vasculature/v1',
      timeSec,
      myocardialPo2MmHg,
      leftHeartFunctionFailed:Boolean(leftHeartFunctionFailed),
      stimulus,
      effect,
      tauDays:TAU_DAYS,
      kPerMin:K_PER_MIN,
      controlAuthority:false,
      provenance:SOURCE,
      numericalMethod:'exact-ZOH update of source first-order delay ODE',
    });
  }

  function snapshot(){
    return Object.freeze({
      schema:'hummod-2013-left-heart-vasculature/v1',
      timeSec,
      effect,
      tauDays:TAU_DAYS,
      kPerMin:K_PER_MIN,
      controlAuthority:false,
      provenance:SOURCE,
      numericalMethod:'exact-ZOH update of source first-order delay ODE',
    });
  }

  return Object.freeze({step,snapshot});
}

module.exports=Object.freeze({
  SOURCE,
  TAU_DAYS,
  K_PER_MIN,
  PO2_ON_STIMULUS,
  hermite,
  createHumMod2013LeftHeartVasculature,
});
