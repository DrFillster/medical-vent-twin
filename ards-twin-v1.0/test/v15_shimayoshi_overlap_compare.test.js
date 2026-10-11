'use strict';
const assert=require('node:assert/strict');
const {compareOverlap}=require('../scripts/compare-shimayoshi-overlap.js');
const row=(time_s,protocol,fb)=>({
  time_s,protocol,peak_Fb_mN_per_mm2:fb,end_cycle_pHi:7,
  end_cycle_ExtCell_O2o_mM:0.2,end_cycle_O2i_mM:0.1,
  end_cycle_ATPTotal_mM:6,end_cycle_PCr_mM:10,end_cycle_Pi_mM:2,
  peak_Cyt_Cai_mM:0.001,
});
const r=[row(0.4,'control',6),row(0.8,'acidosis',5)];
const c=[row(0.4,'control',6),row(0.8,'acidosis',4.95),row(1.2,'acidosis',4)];
const x=compareOverlap(r,c);
assert.equal(x.commonCycles,2);
assert.equal(x.phaseMismatches,0);
assert(Math.abs(x.metrics.peak_Fb_mN_per_mm2.maxRelativeError-0.01)<1e-12);
console.log('ok - source challenge overlap comparison aligns paced cycles and phases');
