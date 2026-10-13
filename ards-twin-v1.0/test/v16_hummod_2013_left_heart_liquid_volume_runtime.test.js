'use strict';

const assert=require('node:assert/strict');
const {
  createHumMod2013LeftHeartLiquidVolumeRuntime,
}=require('../src/hummod_2013_left_heart_liquid_volume_runtime.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}

test('left-heart liquid runtime preserves source initialization fraction',()=>{
  const r=createHumMod2013LeftHeartLiquidVolumeRuntime({
    initialLeftHeartMassG:300,
    initialTissueWaterVolumeMl:40000,
    initialInterstitialWaterVolumeMl:12000,
    initialCellWaterVolumeMl:28000,
  });
  assert(r.fractionTotal>0);
  assert.equal(r.snapshot().liquidVolumeMl,null);
});

test('current LV liquid volume is derived from live whole-body water compartments',()=>{
  const r=createHumMod2013LeftHeartLiquidVolumeRuntime({
    initialLeftHeartMassG:300,
    initialTissueWaterVolumeMl:40000,
    initialInterstitialWaterVolumeMl:12000,
    initialCellWaterVolumeMl:28000,
  });
  const a=r.step({
    dtSec:1,
    interstitialWaterVolumeMl:12000,
    cellWaterVolumeMl:28000,
  });
  const b=r.step({
    dtSec:1,
    interstitialWaterVolumeMl:12500,
    cellWaterVolumeMl:28500,
  });
  assert(Number.isFinite(a.liquidVolumeMl));
  assert(b.liquidVolumeMl>a.liquidVolumeMl);
  assert.equal(b.canonicalControlAuthority,false);
});

test('runtime fails closed without either live water compartment',()=>{
  const r=createHumMod2013LeftHeartLiquidVolumeRuntime({
    initialLeftHeartMassG:300,
    initialTissueWaterVolumeMl:40000,
    initialInterstitialWaterVolumeMl:12000,
    initialCellWaterVolumeMl:28000,
  });
  assert.throws(()=>r.step({
    dtSec:1,
    interstitialWaterVolumeMl:12000,
  }),/cellWaterVolumeMl/);
  assert.throws(()=>r.step({
    dtSec:1,
    cellWaterVolumeMl:28000,
  }),/interstitialWaterVolumeMl/);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
