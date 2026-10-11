'use strict';

const {
  SHIMAYOSHI_ACIDOSIS_GRID_TABLE_V3,
}=require('./shimayoshi_acidosis_grid_data.js');
const {
  createFixedStepShimayoshiAcidosisHistoryGate,
}=require('./shimayoshi_acidosis_history_gate.js');
const {
  myocardialLvPressureShadow,
}=require('./myocardial_lv_pressure_shadow.js');

function finiteNonnegative(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)||v<0){
    throw new Error(label+' must be finite and >= 0');
  }
  return v;
}

function createStatefulShimayoshiAcidosisPressureShadow({
  sourceGridTable=SHIMAYOSHI_ACIDOSIS_GRID_TABLE_V3,
  challengeChangeToleranceMmHg=0.5,
}={}){
  const gate=createFixedStepShimayoshiAcidosisHistoryGate({
    sourceGridTable,
    challengeChangeToleranceMmHg,
  });

  function evaluate({
    myocardialPco2MmHg,
    phase,
    phaseElapsedSec,
    lvVolumeMl,
  }={}){
    finiteNonnegative(phaseElapsedSec,'phaseElapsedSec');
    if(!['control','challenge','recovery'].includes(phase)){
      throw new Error('phase must be control, challenge, or recovery');
    }

    if(phase==='control'){
      const history=gate.evaluate({
        myocardialPco2MmHg,
        sourceProtocolTimeS:0,
        phase:'control',
      });
      return Object.freeze({
        status:history.status,
        history,
        pressureShadow:null,
        lvPressureMmHg:null,
        pressureShadowEligible:false,
        closedLoopPressureAuthority:false,
      });
    }

    const sourceProtocolTimeS=phase==='challenge'
      ? 300+phaseElapsedSec
      : 900+phaseElapsedSec;

    if(phase==='challenge'&&phaseElapsedSec>600){
      throw new Error('challenge phaseElapsedSec exceeds validated 600 s source duration');
    }
    if(phase==='recovery'&&phaseElapsedSec>60){
      throw new Error('recovery phaseElapsedSec exceeds validated 60 s source duration');
    }

    const history=gate.evaluate({
      myocardialPco2MmHg,
      sourceProtocolTimeS,
      phase,
    });

    if(!history.sourcePrediction){
      return Object.freeze({
        status:history.status,
        history,
        pressureShadow:null,
        lvPressureMmHg:null,
        pressureShadowEligible:false,
        closedLoopPressureAuthority:false,
      });
    }

    const prediction=history.sourcePrediction;
    const pressureShadow=myocardialLvPressureShadow({
      lvVolumeMl,
      sourceCellularActiveStressMnPerMm2:prediction.peakFbMnPerMm2,
      sourceStressProvenance:Object.freeze({
        model:'stateful fixed-step Shimayoshi acidosis source-grid shadow',
        upstreamGitSha:sourceGridTable.upstreamGitSha,
        sourceProtocolTimeS,
        phase,
        phaseElapsedSec,
        initialChallengePco2MmHg:history.initialChallengePco2MmHg,
        currentMyocardialPco2MmHg:history.currentMyocardialPco2MmHg,
        lookupMyocardialPco2MmHg:history.lookupMyocardialPco2MmHg,
        stressRatio:prediction.stressRatio,
        fixedStepHistorySupported:true,
        closedLoopPressureAuthority:false,
      }),
    });

    return Object.freeze({
      status:'stateful-Shimayoshi-acidosis-LV-pressure-shadow-complete',
      history,
      pressureShadow,
      lvPressureMmHg:pressureShadow.lvPressureMmHg,
      sourceCellularActiveStressMnPerMm2:prediction.peakFbMnPerMm2,
      stressRatio:prediction.stressRatio,
      pressureShadowEligible:true,
      closedLoopPressureAuthority:false,
      controlAuthority:false,
    });
  }

  return Object.freeze({
    status:'stateful-fixed-step-Shimayoshi-acidosis-pressure-shadow',
    evaluate,
    reset:gate.reset,
    closedLoopPressureAuthority:false,
  });
}

module.exports=Object.freeze({
  createStatefulShimayoshiAcidosisPressureShadow,
});
