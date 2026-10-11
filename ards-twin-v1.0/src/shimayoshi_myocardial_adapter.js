'use strict';

const {
  myocardialLvPressureShadow,
}=require('./myocardial_lv_pressure_shadow.js');
const {
  assessShimayoshiCycleAuthority,
}=require('./shimayoshi_source_authority.js');

function myocardialPressureFromValidatedSourceCycle({
  lvVolumeMl,
  validatedSourceRun,
  cycleIndex,
}={}){
  if(!validatedSourceRun||
     validatedSourceRun.status!=='shimayoshi-source-stress-trajectory-validated'||
     !validatedSourceRun.protocolValidation||
     validatedSourceRun.protocolValidation.status!=='source-protocol-trajectory-valid'||
     !Array.isArray(validatedSourceRun.trajectory)){
    throw new Error('validated Shimayoshi source run is required');
  }
  if(!Number.isInteger(cycleIndex)||cycleIndex<0||
     cycleIndex>=validatedSourceRun.trajectory.length){
    throw new Error('cycleIndex must select an imported source cycle');
  }

  const cycle=validatedSourceRun.trajectory[cycleIndex];
  if(typeof cycle.peak_Fb_mN_per_mm2!=='number'||
     !Number.isFinite(cycle.peak_Fb_mN_per_mm2)||
     cycle.peak_Fb_mN_per_mm2<0){
    throw new Error('selected source cycle has invalid peak Fb');
  }

  const sourceAuthority=assessShimayoshiCycleAuthority({
    validatedSourceRun,
    cycleIndex,
  });

  const sourceStressProvenance=Object.freeze({
    upstreamGitSha:validatedSourceRun.provenance.upstreamGitSha,
    protocol:cycle.protocol,
    sourceTimeS:cycle.time_s,
    cycleIndex,
    stressRatio:cycle.stress_ratio,
    referencePeakStressMnPerMm2:
      validatedSourceRun.referencePeakStressMnPerMm2,
    physiologyChanged:validatedSourceRun.provenance.physiologyChanged,
    sourceProtocolName:validatedSourceRun.provenance.protocolName,
    protocolValidationStatus:validatedSourceRun.protocolValidation.status,
    sourceAuthorityStatus:sourceAuthority.status,
    closedLoopPressureAuthority:sourceAuthority.closedLoopPressureAuthority,
  });

  const pressureShadow=myocardialLvPressureShadow({
    lvVolumeMl,
    sourceCellularActiveStressMnPerMm2:cycle.peak_Fb_mN_per_mm2,
    sourceStressProvenance,
  });

  return Object.freeze({
    ...pressureShadow,
    sourceAuthority,
    closedLoopPressureAuthority:false,
  });
}

module.exports=Object.freeze({
  myocardialPressureFromValidatedSourceCycle,
});
