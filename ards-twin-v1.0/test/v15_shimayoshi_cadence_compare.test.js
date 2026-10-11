'use strict';
const assert=require('node:assert/strict');
const {summarize,compare}=require('../scripts/compare-shimayoshi-cadence.js');

const row=(fb,pHi=7.14)=>({
  peak_Fb_mN_per_mm2:fb,
  end_cycle_pHi:pHi,
  end_cycle_ExtCell_O2o_mM:0.24,
  end_cycle_O2i_mM:0.236,
  end_cycle_ATPTotal_mM:6.92,
  end_cycle_PCr_mM:10.83,
  end_cycle_Pi_mM:1.85,
  peak_Cyt_Cai_mM:0.000838,
});
const ref=[row(6),row(6)];
const same=[row(6),row(6)];
const lower=[row(5.94),row(5.94)];
assert.equal(summarize(ref).meanPeakFb,6);
assert.equal(compare(ref,same).relativeError.meanPeakFb,0);
assert(Math.abs(compare(ref,lower).relativeError.meanPeakFb-0.01)<1e-12);
console.log('ok - Shimayoshi cadence comparator reports source-output relative error only');
