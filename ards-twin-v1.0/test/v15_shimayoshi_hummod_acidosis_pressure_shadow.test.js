'use strict';

const assert=require('node:assert/strict');
const sourceGridTable=require('../artifacts/v1.5/SHIMAYOSHI_ACIDOSIS_GRID_TABLE_V3.json');
const {
  humModMyocardialCo2ToShimayoshiLvPressureShadow,
}=require('../src/shimayoshi_hummod_acidosis_pressure_shadow.js');

const x=humModMyocardialCo2ToShimayoshiLvPressureShadow({
  myocardialPco2MmHg:118.5,
  sourceProtocolTimeS:400,
  lvVolumeMl:120,
  sourceGridTable,
});
assert.equal(x.pressureShadowEligible,true);
assert.equal(x.closedLoopPressureAuthority,false);
assert.equal(x.controlAuthority,false);
assert(Number.isFinite(x.sourceCellularActiveStressMnPerMm2));
assert(Number.isFinite(x.lvPressureMmHg));
assert(x.stressRatio<1);
assert.equal(x.sourceShadow.fittedGain,false);
assert.equal(x.pressureShadow.controlAuthority,false);
console.log('ok - HumMod myocardial PCO2 reaches Kato/Utaki LV pressure through compressed source grid shadow only');

const outside=humModMyocardialCo2ToShimayoshiLvPressureShadow({
  myocardialPco2MmHg:20,
  sourceProtocolTimeS:400,
  lvVolumeMl:120,
  sourceGridTable,
});
assert.equal(outside.pressureShadowEligible,false);
assert.equal(outside.pressureShadow,null);
assert.equal(outside.lvPressureMmHg,null);
assert.equal(outside.closedLoopPressureAuthority,false);
console.log('ok - LV pressure shadow fails closed outside validated Shimayoshi CO2 grid');


const defaultTable=humModMyocardialCo2ToShimayoshiLvPressureShadow({
  myocardialPco2MmHg:118.5,
  sourceProtocolTimeS:400,
  lvVolumeMl:120,
});
assert.equal(defaultTable.closedLoopPressureAuthority,false);
assert(Math.abs(defaultTable.stressRatio-x.stressRatio)<1e-15);
console.log('ok - browser-native validated source grid is the default pressure-shadow table');
