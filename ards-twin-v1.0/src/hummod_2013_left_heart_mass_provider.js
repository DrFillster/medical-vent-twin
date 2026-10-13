'use strict';

/**
 * HumMod 2012/2013 Context-OtherMass -> initial LV mass provider.
 *
 * Source:
 * nysuloem/HumMod-UTSC-CPG@93ee1b30b74a0f2e60a2c961bbf569b4c8237611
 * - Structure/Context/Context-OtherMass.DES
 * - Structure/Sizing/Sizing-OrganMass.DES
 *
 * No stochastic draw is generated here. Stochasm is an explicit input.
 */

const SOURCE=Object.freeze({
  repository:'nysuloem/HumMod-UTSC-CPG',
  revision:'93ee1b30b74a0f2e60a2c961bbf569b4c8237611',
  files:Object.freeze([
    'Structure/Context/Context-OtherMass.DES',
    'Structure/Sizing/Sizing-OrganMass.DES',
  ]),
  authority:'candidate-not-canonical',
});

const OTHER_MASS_KG=Object.freeze({
  male:Object.freeze([19.0,26.0,32.0,46.0]),
  female:Object.freeze([15.0,20.8,28.0,36.0]),
});

const AGE_ON_OTHER_MASS=Object.freeze([
  Object.freeze({x:0,y:0.2,slope:0}),
  Object.freeze({x:2,y:0.3,slope:0}),
  Object.freeze({x:9,y:0.4,slope:0}),
  Object.freeze({x:18,y:1.0,slope:0}),
  Object.freeze({x:30,y:1.0,slope:0}),
  Object.freeze({x:50,y:1.0,slope:0}),
  Object.freeze({x:70,y:1.0,slope:0}),
]);

const LEFT_HEART_PERCENT=1.1;
const LEFT_HEART_H2O_FRACT_MASS=0.67;
const H2O_DENSITY_G_PER_ML=1.0;

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

function contextOtherMass2013({
  sex,
  index,
  ageYears,
  plusMinusPercent=0,
  stochasmPercent,
}={}){
  if(sex!=='male'&&sex!=='female') throw new Error('sex must be male or female');
  if(!Number.isInteger(index)||index<0||index>3) {
    throw new Error('index must be integer 0..3');
  }
  finite(ageYears,'ageYears');
  finite(plusMinusPercent,'plusMinusPercent');
  finite(stochasmPercent,'stochasmPercent');

  const nominalMassKg=OTHER_MASS_KG[sex][index];
  const ageEffectOtherMass=hermite(AGE_ON_OTHER_MASS,ageYears);
  const massKg=
    nominalMassKg*
    (1+(plusMinusPercent/100))*
    (1+(stochasmPercent/100))*
    ageEffectOtherMass;

  return Object.freeze({
    sex,
    index,
    ageYears,
    plusMinusPercent,
    stochasmPercent,
    nominalMassKg,
    ageEffectOtherMass,
    massKg,
    massG:1000*massKg,
    controlAuthority:false,
    provenance:SOURCE,
  });
}

function initialLeftHeartMass2013(inputs={}){
  const other=contextOtherMass2013(inputs);
  const baseMassG=other.massG;
  const initialLeftHeartMassG=(LEFT_HEART_PERCENT/100)*baseMassG;
  const initialLeftHeartLiquidVolumeMl=
    LEFT_HEART_H2O_FRACT_MASS*
    initialLeftHeartMassG/
    H2O_DENSITY_G_PER_ML;
  const initialLeftHeartSolidMassG=
    (1-LEFT_HEART_H2O_FRACT_MASS)*initialLeftHeartMassG;
  return Object.freeze({
    contextOtherMass:other,
    baseMassG,
    leftHeartPercent:LEFT_HEART_PERCENT,
    leftHeartH2oFractMass:LEFT_HEART_H2O_FRACT_MASS,
    h2oDensityGPerMl:H2O_DENSITY_G_PER_ML,
    initialLeftHeartMassG,
    initialLeftHeartLiquidVolumeMl,
    initialLeftHeartSolidMassG,
    controlAuthority:false,
    provenance:SOURCE,
  });
}

module.exports=Object.freeze({
  SOURCE,
  OTHER_MASS_KG,
  AGE_ON_OTHER_MASS,
  LEFT_HEART_PERCENT,
  LEFT_HEART_H2O_FRACT_MASS,
  H2O_DENSITY_G_PER_ML,
  hermite,
  contextOtherMass2013,
  initialLeftHeartMass2013,
});
