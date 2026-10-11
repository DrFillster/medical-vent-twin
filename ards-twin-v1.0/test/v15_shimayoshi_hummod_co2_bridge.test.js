'use strict';

const assert=require('node:assert/strict');
const {
  SHIMAYOSHI_REFERENCE_TOTAL_PRESSURE_MMHG,
  shimayoshiEquivalentCo2PercentFromPco2MmHg,
}=require('../src/shimayoshi_hummod_co2_bridge.js');

assert.equal(SHIMAYOSHI_REFERENCE_TOTAL_PRESSURE_MMHG,790);

const baseline=shimayoshiEquivalentCo2PercentFromPco2MmHg({
  myocardialPco2MmHg:39.5,
});
assert.equal(baseline.sourceEquivalentCo2Percent,5);
assert.equal(baseline.fittedGain,false);
assert.equal(baseline.closedLoopAuthority,false);

const high=shimayoshiEquivalentCo2PercentFromPco2MmHg({
  myocardialPco2MmHg:79,
});
assert.equal(high.sourceEquivalentCo2Percent,10);

assert.throws(
  ()=>shimayoshiEquivalentCo2PercentFromPco2MmHg({myocardialPco2MmHg:-1}),
  /must be finite and >= 0/
);
console.log('ok - HumMod myocardial PCO2 maps dimensionally to Shimayoshi CO2 percent with no fitted gain');
