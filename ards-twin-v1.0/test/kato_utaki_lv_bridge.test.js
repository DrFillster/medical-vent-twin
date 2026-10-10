'use strict';
const assert=require('node:assert/strict');
const {
  PARAMETERS,
  lvRadiusCmFromVolumeMl,
  halfSarcomereLengthUmFromRadiusCm,
  activeLvPressureContributionMmHg,
  normalizedActivePressureRatio,
}=require('../src/kato_utaki_lv_bridge.js');

assert.equal(PARAMETERS.K_R_cm_per_ml,0.012);
assert.equal(PARAMETERS.K_V_cm,1.03);
assert.equal(PARAMETERS.K_L_um_per_cm,0.163);
assert.equal(PARAMETERS.L_b_um,0.682);
assert.equal(PARAMETERS.K_S,7.24);
assert.equal(PARAMETERS.K_u_mmHg_per_mN_per_mm2,7.50064);
assert.equal(PARAMETERS.h_lv_cm,1.35);

const r=lvRadiusCmFromVolumeMl(126.419);
assert(Number.isFinite(r) && r>0);
const l=halfSarcomereLengthUmFromRadiusCm(r);
assert(Number.isFinite(l) && l>0);

const x=activeLvPressureContributionMmHg({
  lvVolumeMl:126.419,
  cellularActiveStressMnPerMm2:1,
});
assert(Number.isFinite(x.activePressureMmHg));
assert.equal(x.totalPressureMmHg,null);
assert.equal(x.controlAuthority,false);

const ratio=normalizedActivePressureRatio({
  lvVolumeMl:126.419,
  cellularActiveStressMnPerMm2:0.5,
  referenceCellularActiveStressMnPerMm2:1,
});
assert.ok(Math.abs(ratio-0.5)<1e-12);
console.log('ok - Kato/Utaki active LV bridge preserves source equations and fails closed for total pressure');
