'use strict';
const assert=require('node:assert/strict');
const {
  initializeLeftHeartSize,
  leftHeartWaterFractions,
  leftHeartSize,
}=require('../src/hummod_left_heart_size_source_aligned.js');

const init=initializeLeftHeartSize({initialOtherBodyMassG:70000});
assert(init.initialMassG>0);
assert(init.initialLiquidVolumeMl>0);

const water=leftHeartWaterFractions({
  initialLiquidVolumeMl:init.initialLiquidVolumeMl,
  initialTissueWaterVolumeMl:30000,
  initialInterstitialWaterVolumeMl:12000,
  initialCellWaterVolumeMl:18000,
});
assert(water.fractionTotal>0);

const live=leftHeartSize({
  fractionTotal:water.fractionTotal,
  interstitialWaterVolumeMl:12000,
  cellWaterVolumeMl:18000,
  contractileProteinMassG:init.initialContractileProteinMassG,
  initialOtherMassG:init.initialOtherMassG,
});
assert(Math.abs(live.liquidVolumeMl-init.initialLiquidVolumeMl)<1e-12);
assert(live.volumeMl>live.liquidVolumeMl);
assert.equal(live.controlAuthority,false);
console.log('ok - LeftHeart-Size source algebra scales global water states without invented heart volume');
