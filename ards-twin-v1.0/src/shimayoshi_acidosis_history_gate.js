'use strict';

const {
  evaluateHumModToShimayoshiAcidosisShadow,
}=require('./shimayoshi_hummod_acidosis_shadow.js');

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite');
  return v;
}

function createFixedStepShimayoshiAcidosisHistoryGate({
  sourceGridTable,
  challengeChangeToleranceMmHg=0.5,
}={}){
  finite(challengeChangeToleranceMmHg,'challengeChangeToleranceMmHg');
  if(challengeChangeToleranceMmHg<0){
    throw new Error('challengeChangeToleranceMmHg must be >= 0');
  }

  let activeChallengePco2MmHg=null;
  let unsupportedDynamicHistory=false;

  function reset(){
    activeChallengePco2MmHg=null;
    unsupportedDynamicHistory=false;
  }

  function evaluate({
    myocardialPco2MmHg,
    sourceProtocolTimeS,
    phase,
  }={}){
    finite(myocardialPco2MmHg,'myocardialPco2MmHg');
    finite(sourceProtocolTimeS,'sourceProtocolTimeS');
    if(!['control','challenge','recovery'].includes(phase)){
      throw new Error('phase must be control, challenge, or recovery');
    }

    if(phase==='control'){
      reset();
      return Object.freeze({
        status:'Shimayoshi-acidosis-history-gate-control',
        sourcePrediction:null,
        fixedStepHistorySupported:true,
        closedLoopAuthority:false,
      });
    }

    if(phase==='challenge'){
      if(activeChallengePco2MmHg==null){
        activeChallengePco2MmHg=myocardialPco2MmHg;
      }else if(Math.abs(myocardialPco2MmHg-activeChallengePco2MmHg)>
               challengeChangeToleranceMmHg){
        unsupportedDynamicHistory=true;
      }
    }

    if(unsupportedDynamicHistory){
      return Object.freeze({
        status:'dynamic-myocardial-CO2-history-outside-validated-Shimayoshi-surrogate',
        sourcePrediction:null,
        fixedStepHistorySupported:false,
        initialChallengePco2MmHg:activeChallengePco2MmHg,
        currentMyocardialPco2MmHg:myocardialPco2MmHg,
        reason:'Validated fixed-step source trajectories do not preserve accuracy after challenge CO2 changes during the same exposure history.',
        closedLoopAuthority:false,
      });
    }

    if(phase==='recovery'&&activeChallengePco2MmHg==null){
      return Object.freeze({
        status:'Shimayoshi-acidosis-recovery-history-missing',
        sourcePrediction:null,
        fixedStepHistorySupported:false,
        currentMyocardialPco2MmHg:myocardialPco2MmHg,
        reason:'Recovery source trajectory requires the preceding fixed challenge level.',
        closedLoopAuthority:false,
      });
    }

    const lookupPco2MmHg=phase==='recovery'
      ? activeChallengePco2MmHg
      : myocardialPco2MmHg;

    const shadow=evaluateHumModToShimayoshiAcidosisShadow({
      myocardialPco2MmHg:lookupPco2MmHg,
      sourceProtocolTimeS,
      sourceGridTable,
    });

    return Object.freeze({
      ...shadow,
      currentMyocardialPco2MmHg:myocardialPco2MmHg,
      lookupMyocardialPco2MmHg:lookupPco2MmHg,
      fixedStepHistorySupported:true,
      initialChallengePco2MmHg:activeChallengePco2MmHg,
      closedLoopAuthority:false,
    });
  }

  return Object.freeze({
    status:'Shimayoshi-fixed-step-acidosis-history-gate',
    closedLoopAuthority:false,
    evaluate,
    reset,
  });
}

module.exports=Object.freeze({
  createFixedStepShimayoshiAcidosisHistoryGate,
});
