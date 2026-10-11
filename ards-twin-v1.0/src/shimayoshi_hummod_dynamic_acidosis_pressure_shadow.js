'use strict';

const {
  shimayoshiEquivalentCo2PercentFromPco2MmHg,
}=require('./shimayoshi_hummod_co2_bridge.js');
const {
  createShimayoshiDynamicAcidosisSurrogate,
}=require('./shimayoshi_dynamic_acidosis_surrogate.js');
const {
  myocardialLvPressureShadow,
}=require('./myocardial_lv_pressure_shadow.js');

function createHumModDynamicAcidosisPressureShadow(){
  const surrogate=createShimayoshiDynamicAcidosisSurrogate();

  function step({
    dtSec,
    myocardialPco2MmHg,
    lvVolumeMl,
  }={}){
    const bridge=shimayoshiEquivalentCo2PercentFromPco2MmHg({
      myocardialPco2MmHg,
    });

    const u=bridge.sourceEquivalentCo2Percent;
    if(u<5||u>30){
      return Object.freeze({
        status:'outside-validated-Shimayoshi-dynamic-acidosis-domain',
        myocardialPco2MmHg,
        sourceEquivalentCo2Percent:u,
        sourceState:null,
        pressureShadow:null,
        lvPressureMmHg:null,
        pressureShadowEligible:false,
        closedLoopPressureAuthority:false,
        controlAuthority:false,
      });
    }

    const sourceState=surrogate.step({
      dtSec,
      sourceEquivalentCo2Percent:u,
    });

    const pressureShadow=myocardialLvPressureShadow({
      lvVolumeMl,
      sourceCellularActiveStressMnPerMm2:sourceState.peakFbMnPerMm2,
      sourceStressProvenance:Object.freeze({
        model:'Shimayoshi two-state dynamic respiratory-acidosis surrogate',
        upstreamGitSha:sourceState.provenance.upstreamGitSha,
        myocardialPco2MmHg,
        sourceEquivalentCo2Percent:u,
        fastDepressiveState:sourceState.fastDepressiveState,
        slowAdaptiveState:sourceState.slowAdaptiveState,
        stressRatio:sourceState.stressRatio,
        fittedToBedsideVariables:false,
        closedLoopPressureAuthority:false,
      }),
    });

    return Object.freeze({
      status:'HumMod-myocardial-PCO2-to-dynamic-Shimayoshi-LV-pressure-shadow-complete',
      myocardialPco2MmHg,
      sourceEquivalentCo2Percent:u,
      sourceState,
      pressureShadow,
      lvPressureMmHg:pressureShadow.lvPressureMmHg,
      sourceCellularActiveStressMnPerMm2:sourceState.peakFbMnPerMm2,
      stressRatio:sourceState.stressRatio,
      pressureShadowEligible:true,
      closedLoopPressureAuthority:false,
      controlAuthority:false,
    });
  }

  return Object.freeze({
    status:'HumMod-dynamic-Shimayoshi-acidosis-pressure-shadow',
    step,
    snapshot:surrogate.snapshot,
    reset:surrogate.reset,
    closedLoopPressureAuthority:false,
  });
}

module.exports=Object.freeze({
  createHumModDynamicAcidosisPressureShadow,
});
