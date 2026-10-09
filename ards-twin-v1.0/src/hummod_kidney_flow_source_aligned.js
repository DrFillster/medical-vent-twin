'use strict';

const {hermite}=require('./hummod_ards_autonomic_source_aligned.js');
const {humModSource}=require('./hummod_source_identity.js');

const ARCUATE_BASIC_CONDUCTANCE=600;
const AFFERENT_BASIC_CONDUCTANCE=34;
const EFFERENT_BASIC_CONDUCTANCE=23;

const TGF_EFFECT=Object.freeze([
  Object.freeze({x:0,y:1.2,slope:0}),
  Object.freeze({x:1.3,y:1.0,slope:-0.4}),
  Object.freeze({x:3.0,y:0.6,slope:0}),
]);
const AFFERENT_SYMP_EFFECT=Object.freeze([
  Object.freeze({x:1.5,y:1.0,slope:0}),
  Object.freeze({x:7.0,y:0.9,slope:0}),
]);
const MYOGENIC_EFFECT=Object.freeze([
  Object.freeze({x:-20,y:1.2,slope:0}),
  Object.freeze({x:0,y:1.0,slope:-0.02}),
  Object.freeze({x:20,y:0.8,slope:0}),
]);
const EFFERENT_A2_EFFECT=Object.freeze([
  Object.freeze({x:0,y:1.2,slope:0}),
  Object.freeze({x:1.3,y:1.0,slope:-0.4}),
  Object.freeze({x:3.0,y:0.6,slope:0}),
]);
const EFFERENT_SYMP_EFFECT=Object.freeze([
  Object.freeze({x:1.5,y:1.0,slope:0}),
  Object.freeze({x:7.0,y:0.3,slope:0}),
]);

function finite(v,label){if(typeof v!=='number'||!Number.isFinite(v))throw new Error(label+' must be finite');return v;}
function positive(v,label){finite(v,label);if(!(v>0))throw new Error(label+' must be > 0');return v;}
function nonNegative(v,label){finite(v,label);if(v<0)throw new Error(label+' must be >= 0');return v;}

function kidneySegmentConductances({
  nephronCountFraction=1,
  tgfVascularSignal,
  kidneyAlphaReceptorActivity,
  myogenicPressureChangeMmHg,
  a2PoolLog10Conc,
  anesthesiaVascularConductance=1,
  arcuateStenosis=1,
}={}){
  positive(nephronCountFraction,'nephronCountFraction');
  finite(tgfVascularSignal,'tgfVascularSignal');
  finite(kidneyAlphaReceptorActivity,'kidneyAlphaReceptorActivity');
  finite(myogenicPressureChangeMmHg,'myogenicPressureChangeMmHg');
  finite(a2PoolLog10Conc,'a2PoolLog10Conc');
  positive(anesthesiaVascularConductance,'anesthesiaVascularConductance');
  positive(arcuateStenosis,'arcuateStenosis');

  const arcuateConductance=ARCUATE_BASIC_CONDUCTANCE/arcuateStenosis;
  const tgfEffect=hermite(TGF_EFFECT,tgfVascularSignal);
  const afferentSympEffect=hermite(AFFERENT_SYMP_EFFECT,kidneyAlphaReceptorActivity);
  const myogenicEffect=hermite(MYOGENIC_EFFECT,myogenicPressureChangeMmHg);
  const afferentConductance=
    AFFERENT_BASIC_CONDUCTANCE*
    nephronCountFraction*
    tgfEffect*
    afferentSympEffect*
    myogenicEffect*
    anesthesiaVascularConductance;

  const a2Effect=hermite(EFFERENT_A2_EFFECT,a2PoolLog10Conc);
  const efferentSympEffect=hermite(EFFERENT_SYMP_EFFECT,kidneyAlphaReceptorActivity);
  const efferentConductance=
    EFFERENT_BASIC_CONDUCTANCE*
    nephronCountFraction*
    a2Effect*
    efferentSympEffect*
    anesthesiaVascularConductance;

  return Object.freeze({
    arcuateConductance,
    afferentConductance,
    efferentConductance,
    tgfEffect,
    afferentSympEffect,
    myogenicEffect,
    a2Effect,
    efferentSympEffect,
  });
}

function kidneyBloodFlow({
  pressureGradientMmHg,
  plasmaVolumeFraction,
  ...segmentInputs
}={}){
  finite(pressureGradientMmHg,'pressureGradientMmHg');
  nonNegative(plasmaVolumeFraction,'plasmaVolumeFraction');
  if(plasmaVolumeFraction>1) throw new Error('plasmaVolumeFraction must be <= 1');
  const s=kidneySegmentConductances(segmentInputs);
  const conductance=1/(
    (1/s.arcuateConductance)+
    (1/s.afferentConductance)+
    (1/s.efferentConductance)
  );
  const bloodFlowMlPerMin=Math.max(pressureGradientMmHg*conductance,0);
  return Object.freeze({
    ...s,
    conductance,
    bloodFlowMlPerMin,
    plasmaFlowMlPerMin:bloodFlowMlPerMin*plasmaVolumeFraction,
    provenance:Object.freeze({
      status:'source-aligned-equation',
      kidneyFlow:humModSource('Structure/Kidney/Kidney-Flow.DES','Kidney-Flow.Calc'),
      arcuate:humModSource('Structure/Kidney/Kidney-ArcuateArtery.DES','Kidney-ArcuateArtery.CalcConductance'),
      afferent:humModSource('Structure/Kidney/Kidney-AfferentArtery.DES','Kidney-AfferentArtery.Dervs'),
      efferent:humModSource('Structure/Kidney/Kidney-EfferentArtery.DES','Kidney-EfferentArtery.Dervs'),
      clinicalValidation:false,
    }),
  });
}

module.exports={
  ARCUATE_BASIC_CONDUCTANCE,AFFERENT_BASIC_CONDUCTANCE,EFFERENT_BASIC_CONDUCTANCE,
  TGF_EFFECT,AFFERENT_SYMP_EFFECT,MYOGENIC_EFFECT,EFFERENT_A2_EFFECT,EFFERENT_SYMP_EFFECT,
  kidneySegmentConductances,kidneyBloodFlow,
};
