'use strict';

const {
  evaluateHumModToShimayoshiAcidosisShadow,
}=require('./shimayoshi_hummod_acidosis_shadow.js');
const {
  myocardialLvPressureShadow,
}=require('./myocardial_lv_pressure_shadow.js');

function humModMyocardialCo2ToShimayoshiLvPressureShadow({
  myocardialPco2MmHg,
  sourceProtocolTimeS,
  lvVolumeMl,
  sourceGridTable,
}={}){
  if(!sourceGridTable){
    throw new Error('validated Shimayoshi acidosis sourceGridTable is required');
  }
  const sourceShadow=evaluateHumModToShimayoshiAcidosisShadow({
    myocardialPco2MmHg,
    sourceProtocolTimeS,
    sourceGridTable,
  });

  if(!sourceShadow.sourcePrediction){
    return Object.freeze({
      status:sourceShadow.status,
      sourceShadow,
      pressureShadow:null,
      lvPressureMmHg:null,
      pressureShadowEligible:false,
      closedLoopPressureAuthority:false,
      controlAuthority:false,
    });
  }

  const prediction=sourceShadow.sourcePrediction;
  const pressureShadow=myocardialLvPressureShadow({
    lvVolumeMl,
    sourceCellularActiveStressMnPerMm2:prediction.peakFbMnPerMm2,
    sourceStressProvenance:Object.freeze({
      model:'Shimayoshi acidosis compressed source-grid surrogate',
      upstreamGitSha:sourceGridTable.upstreamGitSha,
      sourceChallengeCo2Percent:sourceShadow.sourceEquivalentCo2Percent,
      sourceProtocolTimeS,
      stressRatio:prediction.stressRatio,
      interpolatedChallenge:prediction.interpolatedChallenge,
      interpolatedTime:prediction.interpolatedTime,
      fittedGain:false,
      closedLoopPressureAuthority:false,
    }),
  });

  return Object.freeze({
    status:'HumMod-myocardial-PCO2-to-Shimayoshi-LV-pressure-shadow-complete',
    sourceShadow,
    pressureShadow,
    lvPressureMmHg:pressureShadow.lvPressureMmHg,
    sourceCellularActiveStressMnPerMm2:prediction.peakFbMnPerMm2,
    stressRatio:prediction.stressRatio,
    pressureShadowEligible:true,
    closedLoopPressureAuthority:false,
    controlAuthority:false,
  });
}

module.exports=Object.freeze({
  humModMyocardialCo2ToShimayoshiLvPressureShadow,
});
