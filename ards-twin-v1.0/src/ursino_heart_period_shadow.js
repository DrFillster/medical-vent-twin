'use strict';

/**
 * Interim Ursino/Magosso heart-period shadow reconstruction.
 *
 * IMPORTANT:
 * - Diagnostic/counterfactual only. Never drives the live patient.
 * - Equation structure is reproduced from the published Ursino/Magosso family.
 * - Parameter values are cross-transcribed from independent open model
 *   implementations that label their Tables 17-18 as Magosso2001/Ursino2000.
 * - Primary-paper line-by-line verification remains REQUIRED before authority.
 *
 * Structure:
 *   sigma_Ts = G_Ts * ln(max(f_sh(t-DT_s), f_es,min) - f_es,min + 1)
 *   dTs/dt   = (-Ts + sigma_Ts) / tau_Ts
 *   sigma_Tv = G_Tv * f_v(t-DT_v)
 *   dTv/dt   = (-Tv + sigma_Tv) / tau_Tv
 *   T        = T0 + Ts + Tv
 *   HR       = 60 / T
 */

const SOURCE=Object.freeze({
  primaryFamily:Object.freeze({
    citation:
      'Ursino M, Magosso E. Role of short-term cardiovascular regulation in heart period variability: a modeling study. Am J Physiol Heart Circ Physiol. 2003;284:H1479-H1493.',
    doi:'10.1152/ajpheart.00850.2002',
    pmid:'12595291',
  }),
  secondaryTranscription:Object.freeze({
    repository:'Sheng-Ya/OpenCRS',
    revision:'86085d6e64ad0e82232a9f2c9aaa303a0296cc34',
    tables:'Reduced/Parameters.py Tables 17-18',
    independentCrossCheck:
      'circulatory-autogen lung_control_parameters.csv labels G_Ts/G_Tv/tau_Ts/tau_Tv as Magosso2001AndUrsino2000',
  }),
  status:'interim-secondary-transcription-primary-verification-required',
  controlAuthority:false,
});

const P=Object.freeze({
  sympatheticDelaySec:2,
  vagalDelaySec:0.2,
  sympatheticGainSec:-0.13,
  vagalGainSec2:0.09,
  basalHeartPeriodSec:0.58,
  sympatheticTauSec:2,
  vagalTauSec:1.5,
  sympatheticThresholdSpikesPerSec:2.66,
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
function lagExact(current,target,dtSec,tauSec){
  if(current==null) return target;
  if(dtSec===0) return current;
  const decay=Math.exp(-dtSec/tauSec);
  return target+(current-target)*decay;
}

function delayed(history,timeSec,delaySec,fallback){
  const target=timeSec-delaySec;
  if(target<=history[0].timeSec) return fallback;
  for(let i=history.length-1;i>=1;i--){
    const b=history[i],a=history[i-1];
    if(a.timeSec<=target&&target<=b.timeSec){
      const span=b.timeSec-a.timeSec;
      if(span<=0) return a.value;
      const w=(target-a.timeSec)/span;
      return a.value+(b.value-a.value)*w;
    }
  }
  return history[history.length-1].value;
}

function createUrsinoHeartPeriodShadow(){
  let shHistory=[];
  let vHistory=[];
  let tsChangeSec=null;
  let tvChangeSec=null;
  let previousTimeSec=null;
  let state=Object.freeze({
    heartPeriodSec:null,
    heartRatePerMin:null,
    sympatheticPeriodChangeSec:null,
    vagalPeriodChangeSec:null,
    authority:'counterfactual-shadow-only',
    publicationStatus:'interim-secondary-transcription-primary-verification-required',
    provenance:SOURCE,
  });

  function step({timeSec,fShSpikesPerSec,fVSpikesPerSec}={}){
    nonNegative(timeSec,'timeSec');
    finite(fShSpikesPerSec,'fShSpikesPerSec');
    finite(fVSpikesPerSec,'fVSpikesPerSec');
    const dtSec=previousTimeSec==null?0:Math.max(0,timeSec-previousTimeSec);
    previousTimeSec=timeSec;

    shHistory.push({timeSec,value:fShSpikesPerSec});
    vHistory.push({timeSec,value:fVSpikesPerSec});
    const cutoff=timeSec-Math.max(P.sympatheticDelaySec,P.vagalDelaySec)-5;
    while(shHistory.length>2&&shHistory[1].timeSec<cutoff) shHistory.shift();
    while(vHistory.length>2&&vHistory[1].timeSec<cutoff) vHistory.shift();

    const fShDelayed=delayed(
      shHistory,timeSec,P.sympatheticDelaySec,fShSpikesPerSec);
    const fVDelayed=delayed(
      vHistory,timeSec,P.vagalDelaySec,fVSpikesPerSec);

    const sigmaTs=P.sympatheticGainSec*Math.log(
      Math.max(fShDelayed,P.sympatheticThresholdSpikesPerSec)-
      P.sympatheticThresholdSpikesPerSec+1
    );
    const sigmaTv=P.vagalGainSec2*fVDelayed;

    tsChangeSec=lagExact(
      tsChangeSec,sigmaTs,dtSec,P.sympatheticTauSec);
    tvChangeSec=lagExact(
      tvChangeSec,sigmaTv,dtSec,P.vagalTauSec);

    const heartPeriodSec=
      P.basalHeartPeriodSec+tsChangeSec+tvChangeSec;
    const heartRatePerMin=heartPeriodSec>0
      ? 60/heartPeriodSec
      : null;

    state=Object.freeze({
      timeSec,
      fShDelayedSpikesPerSec:fShDelayed,
      fVDelayedSpikesPerSec:fVDelayed,
      sympatheticTargetPeriodChangeSec:sigmaTs,
      vagalTargetPeriodChangeSec:sigmaTv,
      sympatheticPeriodChangeSec:tsChangeSec,
      vagalPeriodChangeSec:tvChangeSec,
      heartPeriodSec,
      heartRatePerMin,
      authority:'counterfactual-shadow-only',
      publicationStatus:
        'interim-secondary-transcription-primary-verification-required',
      provenance:SOURCE,
    });
    return state;
  }

  return Object.freeze({step,snapshot:()=>state,parameters:P,source:SOURCE});
}

module.exports=Object.freeze({SOURCE,P,createUrsinoHeartPeriodShadow});
