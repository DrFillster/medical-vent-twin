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

const mechanics=(time_s,protocol,fb,scale)=>({
  ...row(time_s,protocol,fb),
  start_cycle_hsmL_um:1.04,
  min_cycle_hsmL_um:1.00*scale,
  max_cycle_hsmL_um:1.05,
  end_cycle_hsmL_um:1.03,
  end_cycle_hsmX_um:1.025,
  cycle_hsmL_excursion_um:1.05-(1.00*scale),
  cycle_peak_shortening_um:Math.max(0,1.04-(1.00*scale)),
  cycle_net_hsmL_change_um:-0.01,
});
const mr=[mechanics(0.4,'control',6,1),mechanics(0.8,'ischemia',5,1)];
const mc=[mechanics(0.4,'control',6,1),mechanics(0.8,'ischemia',5,0.999)];
const mx=compareOverlap(mr,mc);
assert.equal(mx.mechanicsCompared,true);
assert(mx.metrics.min_cycle_hsmL_um.maxRelativeError>0);
assert(mx.metrics.cycle_hsmL_excursion_um.maxRelativeError>0);
console.log('ok - source overlap comparison includes sarcomere mechanics when present');
