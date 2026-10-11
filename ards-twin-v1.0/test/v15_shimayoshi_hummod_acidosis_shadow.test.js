'use strict';

const assert=require('node:assert/strict');
const {
  evaluateHumModToShimayoshiAcidosisShadow,
}=require('../src/shimayoshi_hummod_acidosis_shadow.js');

function rows(scale){
  return [
    {time_s:300,protocol:'acidosis',peak_Fb_mN_per_mm2:6,stress_ratio:1},
    {time_s:400,protocol:'acidosis',peak_Fb_mN_per_mm2:6*scale,stress_ratio:scale},
  ];
}
const table={
  schema:'shimayoshi-acidosis-grid-table/v1',
  upstreamGitSha:'6478d2ab0acbfc88d3da461d2594658bcb2798ca',
  referencePeakFbMnPerMm2:6,
  closedLoopAuthority:false,
  levels:[
    {sourceChallengeCo2Percent:10,cvodeTargetCadenceMs:0.2,rows:rows(0.95)},
    {sourceChallengeCo2Percent:20,cvodeTargetCadenceMs:0.2,rows:rows(0.85)},
  ],
};

const x=evaluateHumModToShimayoshiAcidosisShadow({
  myocardialPco2MmHg:118.5,
  sourceProtocolTimeS:400,
  sourceGridTable:table,
});
assert.equal(x.sourceEquivalentCo2Percent,15);
assert(Math.abs(x.sourcePrediction.stressRatio-0.90)<1e-12);
assert.equal(x.closedLoopAuthority,false);
assert.equal(x.fittedGain,false);

const outside=evaluateHumModToShimayoshiAcidosisShadow({
  myocardialPco2MmHg:39.5,
  sourceProtocolTimeS:400,
  sourceGridTable:table,
});
assert.equal(outside.sourcePrediction,null);
assert.match(outside.status,/outside-validated/);
assert.equal(outside.closedLoopAuthority,false);
console.log('ok - HumMod myocardial PCO2 can query bounded Shimayoshi source shadow without gaining authority');
