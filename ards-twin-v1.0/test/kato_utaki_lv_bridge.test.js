'use strict';
const assert=require('node:assert/strict');
const {
  PARAMETERS,
  lvRadiusCmFromVolumeMl,
  halfSarcomereLengthUmFromRadiusCm,
  activeLvPressureContributionMmHg,
  normalizedActivePressureRatio,
  passiveWallStressMnPerMm2,
  lvPressureFromCellularStress,
}=require('../src/kato_utaki_lv_bridge.js');

assert.equal(PARAMETERS.K_R_cm_per_ml,0.012);
assert.equal(PARAMETERS.K_V_cm,1.03);
assert.equal(PARAMETERS.K_L_um_per_cm,0.163);
assert.equal(PARAMETERS.L_b_um,0.682);
assert.equal(PARAMETERS.K_S,7.24);
assert.equal(PARAMETERS.K_u_mmHg_per_mN_per_mm2,7.50064);
assert.equal(PARAMETERS.h_lv_cm,1.35);
assert.equal(PARAMETERS.K_PE_mN_per_mm2,0.2692);
assert.equal(PARAMETERS.K_PL_mN_per_mm2,7.561);
assert.equal(PARAMETERS.passiveD,28.08);
assert.equal(PARAMETERS.L0_um,1.043);

const r=lvRadiusCmFromVolumeMl(126.419);
assert(Number.isFinite(r) && r>0);
const l=halfSarcomereLengthUmFromRadiusCm(r);
assert(Number.isFinite(l) && l>0);

const x=activeLvPressureContributionMmHg({
  lvVolumeMl:126.419,
  cellularActiveStressMnPerMm2:1,
});
assert(Number.isFinite(x.activePressureMmHg));
assert(Number.isFinite(x.totalPressureMmHg));
assert.equal(x.controlAuthority,false);

const ratio=normalizedActivePressureRatio({
  lvVolumeMl:126.419,
  cellularActiveStressMnPerMm2:0.5,
  referenceCellularActiveStressMnPerMm2:1,
});
assert.ok(Math.abs(ratio-0.5)<1e-12);
console.log('ok - Kato/Utaki active LV bridge preserves source equations and fails closed for total pressure');

assert.ok(Math.abs(passiveWallStressMnPerMm2(PARAMETERS.L0_um))<1e-12);
assert(passiveWallStressMnPerMm2(PARAMETERS.L0_um*0.99)<0);
assert(passiveWallStressMnPerMm2(PARAMETERS.L0_um*1.01)>0);

const total=lvPressureFromCellularStress({
  lvVolumeMl:126.419,
  cellularActiveStressMnPerMm2:1,
});
assert(Number.isFinite(total.totalPressureMmHg));
assert(Number.isFinite(total.passiveWallStressMnPerMm2));
assert.match(total.status,/source-complete/);
