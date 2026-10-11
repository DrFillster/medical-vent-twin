'use strict';

const {
  myocardialPressureFromValidatedSourceCycle,
}=require('./shimayoshi_myocardial_adapter.js');

/**
 * Explicit boundary between source-derived myocardial mechanics and the
 * circulation.
 *
 * This object is deliberately NOT a HumMod contractility multiplier.
 * Kato/Utaki supplies LV pressure from source Fb and LV geometry, so the
 * downstream circulation must consume a pressure-driven LV pump boundary.
 */
function leftVentricularSourcePressureBoundary({
  lvVolumeMl,
  validatedSourceRun,
  cycleIndex,
}={}){
  const myocardial=myocardialPressureFromValidatedSourceCycle({
    lvVolumeMl,
    validatedSourceRun,
    cycleIndex,
  });

  if(typeof myocardial.lvPressureMmHg!=='number'||
     !Number.isFinite(myocardial.lvPressureMmHg)){
    throw new Error('source-derived LV pressure must be finite');
  }

  return Object.freeze({
    schema:'shimayoshi-kato-left-ventricular-pressure-boundary/v1',
    mode:'pressure-driven-left-ventricle',
    lvVolumeMl,
    lvPressureMmHg:myocardial.lvPressureMmHg,
    sourceCellularActiveStressMnPerMm2:
      myocardial.sourceCellularActiveStressMnPerMm2,
    sourceStressProvenance:myocardial.sourceStressProvenance,
    contractilityMultiplier:null,
    requiresPressureDrivenPump:true,
    controlAuthority:false,
    myocardial,
  });
}

module.exports=Object.freeze({
  leftVentricularSourcePressureBoundary,
});
