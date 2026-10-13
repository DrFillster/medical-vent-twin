'use strict';

const assert=require('node:assert/strict');
const {
  H2O_FRACT_MASS,
  READINESS,
  initialLeftHeartComposition2013,
  leftHeartWaterScaling2013,
  currentLeftHeartLiquidVolume2013,
}=require('../src/hummod_2013_left_heart_liquid_volume_provider.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}
function near(a,b,tol=1e-12){
  assert(Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b)),
    a+' not near '+b);
}

test('2013 source initial LV composition uses 67 percent water mass',()=>{
  near(H2O_FRACT_MASS,0.67);
  const s=initialLeftHeartComposition2013({initialLeftHeartMassG:286});
  near(s.initialLiquidVolumeMl,0.67*286);
  near(s.initialSolidMassG,0.33*286);
});

test('LV water scaling preserves source FractionTotal algebra',()=>{
  const s=leftHeartWaterScaling2013({
    initialLeftHeartLiquidVolumeMl:191.62,
    initialTissueWaterVolumeMl:30000,
    initialInterstitialWaterVolumeMl:11000,
    initialCellWaterVolumeMl:19000,
  });
  near(s.fractionTotal,191.62/30000);
  near(
    s.initialLeftHeartInterstitialVolumeMl+
      s.initialLeftHeartCellWaterVolumeMl,
    191.62
  );
});

test('current liquid volume follows global interstitial plus cell water',()=>{
  const scale=leftHeartWaterScaling2013({
    initialLeftHeartLiquidVolumeMl:191.62,
    initialTissueWaterVolumeMl:30000,
    initialInterstitialWaterVolumeMl:11000,
    initialCellWaterVolumeMl:19000,
  });
  const s=currentLeftHeartLiquidVolume2013({
    fractionTotal:scale.fractionTotal,
    interstitialWaterVolumeMl:12000,
    cellWaterVolumeMl:18500,
  });
  near(
    s.liquidVolumeMl,
    scale.fractionTotal*(12000+18500)
  );
});

test('current LV liquid volume remains fail-closed without whole-body water providers',()=>{
  assert.equal(
    READINESS.currentLiquidVolume,
    'blocked-on-whole-body-water-compartments'
  );
  assert.equal(READINESS.fixedInitialLiquidVolumeSubstitutionAllowed,false);
  assert(READINESS.missingLiveProviders.includes('InterstitialWater.Vol'));
  assert(READINESS.missingLiveProviders.includes('CellH2O.Vol'));
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
