'use strict';

const {
  initialState,
  advanceDynamicCandidate,
}=require('./shimayoshi_acidosis_dynamic_candidate.js');
const {
  myocardialLvPressureShadow,
}=require('./myocardial_lv_pressure_shadow.js');

function initialDynamicPressureShadowState(){
  return Object.freeze({
    myocardial:initialState(),
    lastPressureShadow:null,
    closedLoopPressureAuthority:false,
    controlAuthority:false,
  });
}

function advanceDynamicAcidosisPressureShadow({
  state,
  sourceCo2Percent,
  dtSec,
  lvVolumeMl,
}={}){
  if(!state||!state.myocardial){
    throw new Error('dynamic acidosis pressure shadow state is required');
  }

  const myocardial=advanceDynamicCandidate({
    state:state.myocardial,
    sourceCo2Percent,
    dtSec,
  });

  const pressureShadow=myocardialLvPressureShadow({
    lvVolumeMl,
    sourceCellularActiveStressMnPerMm2:myocardial.peakFbMnPerMm2,
    sourceStressProvenance:Object.freeze({
      model:'Shimayoshi two-state respiratory-acidosis dynamic candidate',
      sourceCo2Percent,
      stressRatio:myocardial.stressRatio,
      fittedToBlindDynamicTrajectory:false,
      closedLoopPressureAuthority:false,
    }),
  });

  return Object.freeze({
    status:'shimayoshi-dynamic-acidosis-LV-pressure-shadow',
    myocardial,
    pressureShadow,
    lvPressureMmHg:pressureShadow.lvPressureMmHg,
    stressRatio:myocardial.stressRatio,
    sourceCellularActiveStressMnPerMm2:myocardial.peakFbMnPerMm2,
    closedLoopPressureAuthority:false,
    controlAuthority:false,
  });
}

module.exports=Object.freeze({
  initialDynamicPressureShadowState,
  advanceDynamicAcidosisPressureShadow,
});
