'use strict';
const assert=require('node:assert/strict');
const {
  myocardialLvPressureShadow,
}=require('../src/myocardial_lv_pressure_shadow.js');

const blocked=myocardialLvPressureShadow({lvVolumeMl:120});
assert.equal(blocked.lvPressureMmHg,null);
assert.match(blocked.status,/Shimayoshi-source-stress/);
assert.equal(blocked.controlAuthority,false);

const x=myocardialLvPressureShadow({
  lvVolumeMl:120,
  sourceCellularActiveStressMnPerMm2:1,
  sourceStressProvenance:'test-source-only',
});
assert(Number.isFinite(x.lvPressureMmHg));
assert(x.lvPressureMmHg>0);
assert.equal(x.sourceStressProvenance,'test-source-only');
assert.equal(x.controlAuthority,false);

assert.throws(
  ()=>myocardialLvPressureShadow({
    lvVolumeMl:120,
    sourceCellularActiveStressMnPerMm2:0,
  }),
  /must be finite and > 0/
);

console.log('ok - myocardial LV pressure shadow cannot synthesize stress from bedside gases');
