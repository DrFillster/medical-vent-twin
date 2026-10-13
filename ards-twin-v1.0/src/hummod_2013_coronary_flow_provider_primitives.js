'use strict';

/**
 * HumMod 2012/2013 coronary-flow provider primitives.
 *
 * Sources:
 * - Structure/Circulation/Viscosity.DES
 * - Structure/LeftHeart/LeftHeart-AlphaReceptors.DES
 *
 * No runtime ownership is implied here.
 */

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

const HCT_ON_VISCOSITY=Object.freeze([
  Object.freeze({x:0.00,y:0.5,slope:0.8}),
  Object.freeze({x:0.44,y:1.0,slope:2.0}),
  Object.freeze({x:0.60,y:1.5,slope:6.0}),
]);

function viscosityFromHematocrit({
  hematocritFraction,
  clamp=false,
  clampLevel=0,
}={}){
  finite(hematocritFraction,'hematocritFraction');
  if(hematocritFraction<0||hematocritFraction>1){
    throw new Error('hematocritFraction must be in [0,1]');
  }
  finite(clampLevel,'clampLevel');
  const value=clamp?clampLevel:hermite(HCT_ON_VISCOSITY,hematocritFraction);
  if(!(value>0)) throw new Error('viscosity value must be > 0');
  return Object.freeze({
    value,
    conductanceEffect:1/value,
    controlAuthority:false,
  });
}

function leftHeartAlphaReceptorActivity({
  cardiacGangliaHz,
  alpha1PoolEffect,
  switchOn=false,
  setting=0,
}={}){
  finite(cardiacGangliaHz,'cardiacGangliaHz');
  finite(alpha1PoolEffect,'alpha1PoolEffect');
  finite(setting,'setting');
  const neuralAgonism=cardiacGangliaHz;
  const humoralAgonism=alpha1PoolEffect;
  const totalAgonism=
    (0.333*neuralAgonism)+(0.5*humoralAgonism);
  return Object.freeze({
    neuralAgonism,
    humoralAgonism,
    totalAgonism,
    activity:switchOn?setting:totalAgonism,
    controlAuthority:false,
  });
}

module.exports=Object.freeze({
  HCT_ON_VISCOSITY,
  hermite,
  viscosityFromHematocrit,
  leftHeartAlphaReceptorActivity,
});
