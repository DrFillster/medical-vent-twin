'use strict';

const assert=require('node:assert/strict');
const {
  shimayoshiAcidosisPressureShadow,
}=require('../src/shimayoshi_acidosis_pressure_shadow.js');

const baseline=shimayoshiAcidosisPressureShadow({
  lvVolumeMl:120,
  challengeCo2Percent:30,
  phase:'challenge',
  elapsedSec:0,
});
const depressed=shimayoshiAcidosisPressureShadow({
  lvVolumeMl:120,
  challengeCo2Percent:30,
  phase:'challenge',
  elapsedSec:120,
});

assert.equal(baseline.closedLoopPressureAuthority,false);
assert.equal(depressed.closedLoopPressureAuthority,false);
assert.equal(depressed.pressure.controlAuthority,false);
assert(depressed.stressRatio<baseline.stressRatio);
assert(depressed.sourceCellularActiveStressMnPerMm2<
  baseline.sourceCellularActiveStressMnPerMm2);
assert(depressed.lvPressureMmHg<baseline.lvPressureMmHg);
console.log('ok - source-fit acidosis depression propagates to LV pressure shadow only');

assert.throws(
  ()=>shimayoshiAcidosisPressureShadow({
    lvVolumeMl:120,
    challengeCo2Percent:5,
    phase:'challenge',
    elapsedSec:10,
  }),
  /outside validated Shimayoshi source grid/
);
console.log('ok - pressure shadow refuses surrogate extrapolation');
