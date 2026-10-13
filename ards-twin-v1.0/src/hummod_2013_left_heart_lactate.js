'use strict';

/**
 * HumMod 2013 LeftHeart-Lactate runtime.
 *
 * Source:
 * nysuloem/HumMod-UTSC-CPG@93ee1b30b74a0f2e60a2c961bbf569b4c8237611
 * Structure/LeftHeart/LeftHeart-Lactate.DES (revised 2013-03-28)
 *
 * Source backward-Euler form:
 * dMass/dt = F1 - F2*Mass
 * F1 = Made - Used + K*[Pool]
 * F2 = K/Volume
 * K = Flow*DC/(Flow+DC)
 *
 * HumMod timebase is minutes.
 */

const SOURCE=Object.freeze({
  repository:'nysuloem/HumMod-UTSC-CPG',
  revision:'93ee1b30b74a0f2e60a2c961bbf569b4c8237611',
  file:'Structure/LeftHeart/LeftHeart-Lactate.DES',
  authority:'candidate-not-canonical',
});

const INITIAL_MASS_MEQ=0.17;
const DC=18.0;
const MEQ_ML_TO_MG_DL=9008.0;
const GLUCOSE_TO_LACTATE=0.99;
const MG_TO_MEQ=0.0112;

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

function createHumMod2013LeftHeartLactate({
  initialMassMeq=INITIAL_MASS_MEQ,
}={}){
  nonNegative(initialMassMeq,'initialMassMeq');
  let massMeq=initialMassMeq;
  let timeSec=0;
  let last=null;

  function concentrations(liquidVolumeMl){
    positive(liquidVolumeMl,'liquidVolumeMl');
    const lacMeqPerMl=massMeq/liquidVolumeMl;
    return Object.freeze({
      massMeq,
      lacMeqPerMl,
      lacMeqPerL:1000*lacMeqPerMl,
      lacMgPerDl:MEQ_ML_TO_MG_DL*lacMeqPerMl,
    });
  }

  function step({
    dtSec,
    liquidVolumeMl,
    bloodFlowMlPerMin,
    anaerobicGlucoseUsedMgPerMin,
    lactateUsedMgPerMin,
    lactatePoolMeqPerMl,
  }={}){
    positive(dtSec,'dtSec');
    positive(liquidVolumeMl,'liquidVolumeMl');
    nonNegative(bloodFlowMlPerMin,'bloodFlowMlPerMin');
    nonNegative(anaerobicGlucoseUsedMgPerMin,'anaerobicGlucoseUsedMgPerMin');
    finite(lactateUsedMgPerMin,'lactateUsedMgPerMin');
    nonNegative(lactatePoolMeqPerMl,'lactatePoolMeqPerMl');

    const before=concentrations(liquidVolumeMl);
    const madeMgPerMin=
      GLUCOSE_TO_LACTATE*anaerobicGlucoseUsedMgPerMin;
    const madeMeqPerMin=MG_TO_MEQ*madeMgPerMin;
    const usedMgPerMin=lactateUsedMgPerMin;
    const usedMeqPerMin=MG_TO_MEQ*usedMgPerMin;
    const k=bloodFlowMlPerMin>0
      ?(bloodFlowMlPerMin*DC)/(bloodFlowMlPerMin+DC)
      :0;
    const f1=madeMeqPerMin-usedMeqPerMin+(k*lactatePoolMeqPerMl);
    const f2=k/liquidVolumeMl;
    const dtMin=dtSec/60;

    massMeq=(massMeq+(dtMin*f1))/(1+(dtMin*f2));
    if(massMeq<0 && massMeq>-1e-12) massMeq=0;
    if(massMeq<0){
      throw new Error('LeftHeart-Lactate mass became negative');
    }

    timeSec+=dtSec;
    const after=concentrations(liquidVolumeMl);
    const outfluxMeqPerMin=k*(after.lacMeqPerMl-lactatePoolMeqPerMl);

    last=Object.freeze({
      schema:'hummod-2013-left-heart-lactate/v1',
      authority:SOURCE.authority,
      canonicalControlAuthority:false,
      timeSec,
      before,
      ...after,
      madeMgPerMin,
      madeMeqPerMin,
      usedMgPerMin,
      usedMeqPerMin,
      bloodFlowMlPerMin,
      liquidVolumeMl,
      lactatePoolMeqPerMl,
      k,
      f1,
      f2,
      outfluxMeqPerMin,
      backwardEulerForm:'Mass_new=(Mass_old+dt*F1)/(1+dt*F2)',
      controlAuthority:false,
      provenance:SOURCE,
    });
    return last;
  }

  return Object.freeze({
    step,
    concentrations,
    snapshot:({liquidVolumeMl}={})=>{
      if(last) return last;
      if(liquidVolumeMl==null){
        return Object.freeze({
          schema:'hummod-2013-left-heart-lactate/v1',
          authority:SOURCE.authority,
          canonicalControlAuthority:false,
          timeSec,
          massMeq,
          controlAuthority:false,
          provenance:SOURCE,
        });
      }
      return Object.freeze({
        schema:'hummod-2013-left-heart-lactate/v1',
        authority:SOURCE.authority,
        canonicalControlAuthority:false,
        timeSec,
        ...concentrations(liquidVolumeMl),
        controlAuthority:false,
        provenance:SOURCE,
      });
    },
  });
}

module.exports=Object.freeze({
  SOURCE,
  INITIAL_MASS_MEQ,
  DC,
  MEQ_ML_TO_MG_DL,
  GLUCOSE_TO_LACTATE,
  MG_TO_MEQ,
  createHumMod2013LeftHeartLactate,
});
