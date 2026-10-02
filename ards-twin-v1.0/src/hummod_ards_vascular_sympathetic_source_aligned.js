'use strict';

const { HUMMOD_SOURCE_IDENTITY } = require('./hummod_source_identity.js');

function finite(v,l){if(typeof v!=='number'||!Number.isFinite(v))throw new Error(l+' must be finite');return v;}

function hermite(points,x){
  finite(x,'curve input');
  if(x<=points[0].x)return points[0].y+points[0].slope*(x-points[0].x);
  const z=points[points.length-1];
  if(x>=z.x)return z.y+z.slope*(x-z.x);
  let i=0;while(i+1<points.length&&x>points[i+1].x)i++;
  const a=points[i],b=points[i+1],h=b.x-a.x,t=(x-a.x)/h;
  return (2*t*t*t-3*t*t+1)*a.y+(t*t*t-2*t*t+t)*h*a.slope+
    (-2*t*t*t+3*t*t)*b.y+(t*t*t-t*t)*h*b.slope;
}

const CURVES=Object.freeze({
  visceralOther:Object.freeze([
    Object.freeze({x:0,y:1.3,slope:0}),
    Object.freeze({x:1,y:1.0,slope:-0.3}),
    Object.freeze({x:5,y:0.1,slope:0}),
  ]),
  skeletalMuscle:Object.freeze([
    Object.freeze({x:0,y:1.3,slope:0}),
    Object.freeze({x:1,y:1.0,slope:-0.2}),
    Object.freeze({x:4,y:0.5,slope:0}),
  ]),
  cardiac:Object.freeze([
    Object.freeze({x:0,y:1.3,slope:0}),
    Object.freeze({x:1,y:1.0,slope:-0.16}),
    Object.freeze({x:4,y:0.8,slope:0}),
  ]),
});

function alphaReceptorActivity({gangliaHz,alphaPoolEffect=1}={}){
  finite(gangliaHz,'gangliaHz');
  finite(alphaPoolEffect,'alphaPoolEffect');
  return 0.333*gangliaHz+0.5*alphaPoolEffect;
}

function sourceSympatheticVascularComponents({gangliaHz,alphaPoolEffect=1}={}){
  const activity=alphaReceptorActivity({gangliaHz,alphaPoolEffect});
  return Object.freeze({
    schema:'hummod-source-sympathetic-vascular-components/v1.2',
    alphaReceptorActivity:activity,
    conductanceMultipliers:Object.freeze({
      boneFatGiOtherRespiratoryMuscle:
        hermite(CURVES.visceralOther,activity),
      skeletalMuscle:
        hermite(CURVES.skeletalMuscle,activity),
      leftRightHeart:
        hermite(CURVES.cardiac,activity),
    }),
    authority:'diagnostic-component-only',
    excludedFromSystemicAuthority:Object.freeze([
      'local tissue PO2 control',
      'A2/angiotensin control',
      'ADH control',
      'metabolic vasodilation',
      'viscosity effects',
      'anesthesia effects',
      'organ vasculature modifiers',
      'skin thermoregulatory sympathetic dilation',
      'kidney-specific vascular control',
      'brain autoregulation',
    ]),
    provenance:Object.freeze({
      sourceRepository:HUMMOD_SOURCE_IDENTITY.canonicalRepository,
      sourceRevision:HUMMOD_SOURCE_IDENTITY.canonicalRevision,
      reproducibilityMirrorRepository:
        HUMMOD_SOURCE_IDENTITY.reproducibilityMirrorRepository,
      reproducibilityMirrorRevision:
        HUMMOD_SOURCE_IDENTITY.reproducibilityMirrorRevision,
      clinicalValidation:false,
    }),
  });
}

module.exports={
  CURVES,
  hermite,
  alphaReceptorActivity,
  sourceSympatheticVascularComponents,
};
