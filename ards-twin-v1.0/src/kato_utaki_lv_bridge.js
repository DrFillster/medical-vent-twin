'use strict';

/**
 * Kato/Himeno/Amano 2024 + Utaki/Shim lineage LV geometry bridge.
 *
 * Source equations:
 *   R_lv = K_R * V_lv + K_V
 *   L    = K_L * R_lv + L_b
 *   F_ext = K_S * F_b + F_p
 *   P_lv = 2 * K_u * F_ext * h_lv / R_lv
 *
 * This implementation exposes the ACTIVE pressure contribution exactly:
 *   F_active = K_S * F_b
 *   P_active = 2 * K_u * F_active * h_lv / R_lv
 *
 * Total P_lv remains fail-closed until Eq. 23 passive force F_p is
 * transcribed with its complete parameter table.
 */

const PARAMETERS=Object.freeze({
  K_R_cm_per_ml:0.012,
  K_V_cm:1.03,
  K_L_um_per_cm:0.163,
  L_b_um:0.682,
  K_S:7.24,
  K_u_mmHg_per_mN_per_mm2:7.50064,
  h_lv_cm:1.35,
  K_PE_mN_per_mm2:0.2692,
  K_PL_mN_per_mm2:7.561,
  passiveD:28.08,
  L0_um:1.043,
});

const SOURCE=Object.freeze({
  primary:Object.freeze({
    citation:'Kato S, Himeno Y, Amano A. Mathematical analysis of left ventricular elastance with respect to afterload change during ejection phase. PLoS Comput Biol. 2024;20:e1011974.',
    doi:'10.1371/journal.pcbi.1011974',
    pmid:'38635493',
  }),
  lineage:Object.freeze({
    shim2007:'10.2170/physiolsci.RP006007',
    utakiScaleMethod:'Advanced Biomedical Engineering 2016;5:32-38',
  }),
  controlAuthority:false,
});

function positive(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)||!(v>0)){
    throw new Error(label+' must be finite and > 0');
  }
  return v;
}

function nonnegative(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)||v<0){
    throw new Error(label+' must be finite and >= 0');
  }
  return v;
}

function lvRadiusCmFromVolumeMl(volumeMl){
  positive(volumeMl,'volumeMl');
  return PARAMETERS.K_R_cm_per_ml*volumeMl+PARAMETERS.K_V_cm;
}

function halfSarcomereLengthUmFromRadiusCm(radiusCm){
  positive(radiusCm,'radiusCm');
  return PARAMETERS.K_L_um_per_cm*radiusCm+PARAMETERS.L_b_um;
}

function scaledActiveWallStressMnPerMm2(cellularActiveStressMnPerMm2){
  nonnegative(cellularActiveStressMnPerMm2,'cellularActiveStressMnPerMm2');
  return PARAMETERS.K_S*cellularActiveStressMnPerMm2;
}

function passiveWallStressMnPerMm2(halfSarcomereLengthUm){
  positive(halfSarcomereLengthUm,'halfSarcomereLengthUm');
  const L=halfSarcomereLengthUm;
  const L0=PARAMETERS.L0_um;
  if(L<L0){
    return -PARAMETERS.K_PL_mN_per_mm2*(1-L/L0);
  }
  return PARAMETERS.K_PE_mN_per_mm2*
    (Math.exp(PARAMETERS.passiveD*(L/L0-1))-1);
}

function lvPressureFromCellularStress({
  lvVolumeMl,
  cellularActiveStressMnPerMm2,
}={}){
  const radiusCm=lvRadiusCmFromVolumeMl(lvVolumeMl);
  const halfSarcomereLengthUm=halfSarcomereLengthUmFromRadiusCm(radiusCm);
  const activeWallStressMnPerMm2=
    scaledActiveWallStressMnPerMm2(cellularActiveStressMnPerMm2);
  const passiveStressMnPerMm2=
    passiveWallStressMnPerMm2(halfSarcomereLengthUm);
  const totalWallStressMnPerMm2=
    activeWallStressMnPerMm2+passiveStressMnPerMm2;
  const totalPressureMmHg=
    2*PARAMETERS.K_u_mmHg_per_mN_per_mm2*
    totalWallStressMnPerMm2*
    PARAMETERS.h_lv_cm/radiusCm;

  return Object.freeze({
    lvVolumeMl,
    radiusCm,
    halfSarcomereLengthUm,
    cellularActiveStressMnPerMm2,
    activeWallStressMnPerMm2,
    passiveWallStressMnPerMm2:passiveStressMnPerMm2,
    totalWallStressMnPerMm2,
    totalPressureMmHg,
    status:'source-complete Kato/Utaki LV geometry and pressure bridge',
    controlAuthority:false,
    provenance:SOURCE,
  });
}

function activeLvPressureContributionMmHg({
  lvVolumeMl,
  cellularActiveStressMnPerMm2,
}={}){
  const radiusCm=lvRadiusCmFromVolumeMl(lvVolumeMl);
  const halfSarcomereLengthUm=halfSarcomereLengthUmFromRadiusCm(radiusCm);
  const activeWallStressMnPerMm2=
    scaledActiveWallStressMnPerMm2(cellularActiveStressMnPerMm2);
  const activePressureMmHg=
    2*PARAMETERS.K_u_mmHg_per_mN_per_mm2*
    activeWallStressMnPerMm2*
    PARAMETERS.h_lv_cm/radiusCm;

  return Object.freeze({
    lvVolumeMl,
    radiusCm,
    halfSarcomereLengthUm,
    cellularActiveStressMnPerMm2,
    activeWallStressMnPerMm2,
    activePressureMmHg,
    totalPressureMmHg:lvPressureFromCellularStress({
      lvVolumeMl,
      cellularActiveStressMnPerMm2,
    }).totalPressureMmHg,
    status:'active component plus source-complete total-pressure bridge available',
    controlAuthority:false,
    provenance:SOURCE,
  });
}

function normalizedActivePressureRatio({
  lvVolumeMl,
  cellularActiveStressMnPerMm2,
  referenceCellularActiveStressMnPerMm2,
}={}){
  const current=activeLvPressureContributionMmHg({
    lvVolumeMl,
    cellularActiveStressMnPerMm2,
  });
  const reference=activeLvPressureContributionMmHg({
    lvVolumeMl,
    cellularActiveStressMnPerMm2:referenceCellularActiveStressMnPerMm2,
  });
  return current.activePressureMmHg/reference.activePressureMmHg;
}

module.exports=Object.freeze({
  PARAMETERS,
  SOURCE,
  lvRadiusCmFromVolumeMl,
  halfSarcomereLengthUmFromRadiusCm,
  scaledActiveWallStressMnPerMm2,
  passiveWallStressMnPerMm2,
  lvPressureFromCellularStress,
  activeLvPressureContributionMmHg,
  normalizedActivePressureRatio,
});
