'use strict';

const {
  lvPressureFromCellularStress,
  SOURCE: LV_BRIDGE_SOURCE,
} = require('./kato_utaki_lv_bridge.js');

/**
 * Composition boundary:
 * Shimayoshi/Crampin myocardial state -> active cellular stress -> Kato/Utaki
 * LV geometry/pressure bridge.
 *
 * This module NEVER synthesizes active stress from arterial pH or PaO2.
 */
const SOURCE=Object.freeze({
  myocardial:'Shimayoshi/Takeuchi/Matsuoka 2026 integrated ventricular myocyte model',
  lvBridge:LV_BRIDGE_SOURCE,
  controlAuthority:false,
});

function finitePositiveOrNull(v,label){
  if(v==null) return null;
  if(typeof v!=='number'||!Number.isFinite(v)||!(v>0)){
    throw new Error(label+' must be finite and > 0 when provided');
  }
  return v;
}

function finiteNonnegativeOrNull(v,label){
  if(v==null) return null;
  if(typeof v!=='number'||!Number.isFinite(v)||v<0){
    throw new Error(label+' must be finite and >= 0 when provided');
  }
  return v;
}

function myocardialLvPressureShadow({
  lvVolumeMl=null,
  sourceCellularActiveStressMnPerMm2=null,
  sourceStressProvenance=null,
}={}){
  const V=finitePositiveOrNull(lvVolumeMl,'lvVolumeMl');
  const stress=finiteNonnegativeOrNull(
    sourceCellularActiveStressMnPerMm2,
    'sourceCellularActiveStressMnPerMm2'
  );

  if(V==null||stress==null){
    return Object.freeze({
      lvVolumeMl:V,
      sourceCellularActiveStressMnPerMm2:stress,
      sourceStressProvenance,
      lvPressureMmHg:null,
      status:stress==null
        ? 'blocked-pending-Shimayoshi-source-stress-trajectory'
        : 'blocked-pending-LV-volume-input',
      controlAuthority:false,
      provenance:SOURCE,
    });
  }

  const bridge=lvPressureFromCellularStress({
    lvVolumeMl:V,
    cellularActiveStressMnPerMm2:stress,
  });

  return Object.freeze({
    lvVolumeMl:V,
    sourceCellularActiveStressMnPerMm2:stress,
    sourceStressProvenance,
    lvPressureMmHg:bridge.totalPressureMmHg,
    bridge,
    status:'source-stress-to-LV-pressure-shadow-complete',
    controlAuthority:false,
    provenance:SOURCE,
  });
}

module.exports=Object.freeze({
  SOURCE,
  myocardialLvPressureShadow,
});
