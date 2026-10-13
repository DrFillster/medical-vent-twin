'use strict';

/**
 * HumMod 2012/2013 myocardial metabolic modifier primitives.
 *
 * Source:
 * nysuloem/HumMod-UTSC-CPG@93ee1b30b74a0f2e60a2c961bbf569b4c8237611
 * - Structure/Metabolism/Thyroid.DES
 * - Structure/Heat/HeatMetabolism.DES
 */

const SOURCE=Object.freeze({
  repository:'nysuloem/HumMod-UTSC-CPG',
  revision:'93ee1b30b74a0f2e60a2c961bbf569b4c8237611',
  authority:'candidate-not-canonical',
});

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

const THYROID_EFFECT=Object.freeze([
  Object.freeze({x:0,y:0.7,slope:0}),
  Object.freeze({x:8,y:1.0,slope:0.04}),
  Object.freeze({x:40,y:1.5,slope:0}),
]);

const HEAT_CORE=Object.freeze([
  Object.freeze({x:10,y:0.0,slope:0}),
  Object.freeze({x:37,y:1.0,slope:0.12}),
  Object.freeze({x:40,y:1.5,slope:0}),
  Object.freeze({x:46,y:0.0,slope:0}),
]);

function thyroidEffectFromPool2013({totalT4T3}={}){
  finite(totalT4T3,'totalT4T3');
  return Object.freeze({
    totalT4T3,
    thyroidEffect:hermite(THYROID_EFFECT,totalT4T3),
    controlAuthority:false,
    provenance:SOURCE,
  });
}

function heatMetabolismCoreFromTemp2013({coreTempC}={}){
  finite(coreTempC,'coreTempC');
  return Object.freeze({
    coreTempC,
    heatMetabolismCore:hermite(HEAT_CORE,coreTempC),
    controlAuthority:false,
    provenance:SOURCE,
  });
}

module.exports=Object.freeze({
  SOURCE,
  THYROID_EFFECT,
  HEAT_CORE,
  hermite,
  thyroidEffectFromPool2013,
  heatMetabolismCoreFromTemp2013,
});
