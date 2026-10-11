'use strict';
const assert=require('node:assert/strict');
const {
  cellWaterVolume,
  initialInterstitialWaterVolume,
  tissueWaterVolume,
}=require('../src/hummod_tissue_water_source_aligned.js');

assert.equal(cellWaterVolume({icfvMl:25000,rbcWaterMl:1500}).volumeMl,23500);
assert.equal(initialInterstitialWaterVolume({
  initialEcfvMl:14000,
  initialPlasmaVolumeMl:3000,
  initialExternalWaterCoreMl:500,
}).volumeMl,10500);
assert.equal(tissueWaterVolume({
  upperVolumeMl:2000,
  middleVolumeMl:5000,
  lowerVolumeMl:3000,
}).volumeMl,10000);
assert.throws(()=>cellWaterVolume({icfvMl:100,rbcWaterMl:101}),/negative/);
console.log('ok - source water algebra computes only source-defined compartment differences and sums');
