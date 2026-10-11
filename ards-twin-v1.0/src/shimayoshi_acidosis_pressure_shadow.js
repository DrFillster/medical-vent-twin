'use strict';

const {
  shimayoshiAcidosisStepSurrogate,
}=require('./shimayoshi_acidosis_step_surrogate.js');
const {
  myocardialLvPressureShadow,
}=require('./myocardial_lv_pressure_shadow.js');

function shimayoshiAcidosisPressureShadow({
  lvVolumeMl,
  challengeCo2Percent,
  phase,
  elapsedSec,
}={}){
  const source=shimayoshiAcidosisStepSurrogate({
    challengeCo2Percent,
    phase,
    elapsedSec,
  });

  const pressure=myocardialLvPressureShadow({
    lvVolumeMl,
    sourceCellularActiveStressMnPerMm2:source.peakFbMnPerMm2,
    sourceStressProvenance:Object.freeze({
      model:'Shimayoshi respiratory-acidosis reduced-order source surrogate',
      phase:source.phase,
      elapsedSec:source.elapsedSec,
      challengeCo2Percent:source.challengeCo2Percent,
      stressRatio:source.stressRatio,
      upstreamGitSha:source.source.upstreamGitSha,
      workflowRunId:source.source.workflowRunId,
      closedLoopPressureAuthority:false,
    }),
  });

  return Object.freeze({
    status:'shimayoshi-acidosis-to-LV-pressure-shadow-complete',
    source,
    pressure,
    lvPressureMmHg:pressure.lvPressureMmHg,
    sourceCellularActiveStressMnPerMm2:source.peakFbMnPerMm2,
    stressRatio:source.stressRatio,
    pressureShadowEligible:true,
    closedLoopPressureAuthority:false,
    controlAuthority:false,
  });
}

module.exports=Object.freeze({
  shimayoshiAcidosisPressureShadow,
});
