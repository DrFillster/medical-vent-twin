'use strict';
const assert=require('node:assert/strict');
const {analyze}=require('../scripts/analyze-shimayoshi-ischemia-mechanics.js');

const x=analyze({
  status:'shimayoshi-source-stress-trajectory-validated',
  referencePeakStressMnPerMm2:6,
  referencePeakShorteningUm:0.1,
  trajectory:[
    {time_s:0.4,protocol:'control',stress_ratio:1,shortening_ratio:1,cycle_peak_shortening_um:0.1,start_cycle_hsmL_um:1,end_cycle_hsmL_um:1,cycle_net_hsmL_change_um:0,end_cycle_pHi:7.1,end_cycle_ExtCell_O2o_mM:0.24,end_cycle_O2i_mM:0.2,end_cycle_ATPTotal_mM:7,end_cycle_PCr_mM:10,end_cycle_Pi_mM:2,peak_Cyt_Cai_mM:0.001},
    {time_s:180.4,protocol:'ischemia',stress_ratio:0.8,shortening_ratio:0.5,cycle_peak_shortening_um:0.05,start_cycle_hsmL_um:1,end_cycle_hsmL_um:0.99,cycle_net_hsmL_change_um:-0.01,end_cycle_pHi:6.8,end_cycle_ExtCell_O2o_mM:0.1,end_cycle_O2i_mM:0.1,end_cycle_ATPTotal_mM:5,end_cycle_PCr_mM:4,end_cycle_Pi_mM:6,peak_Cyt_Cai_mM:0.0012},
    {time_s:1080.4,protocol:'reperfusion',stress_ratio:1.2,shortening_ratio:0.2,cycle_peak_shortening_um:0.02,start_cycle_hsmL_um:0.95,end_cycle_hsmL_um:0.94,cycle_net_hsmL_change_um:-0.01,end_cycle_pHi:6.9,end_cycle_ExtCell_O2o_mM:0.15,end_cycle_O2i_mM:0.12,end_cycle_ATPTotal_mM:4,end_cycle_PCr_mM:3,end_cycle_Pi_mM:7,peak_Cyt_Cai_mM:0.0013},
  ],
});
assert.equal(x.status,'Shimayoshi-ischemia-mechanics-descriptive-analysis-complete');
assert.equal(x.phases.length,3);
assert.equal(x.extrema.minimumShortening.protocol,'reperfusion');
assert.equal(x.extrema.maximumStress.protocol,'reperfusion');
assert.equal(x.controlAuthority,false);
console.log('ok - ischemia mechanics analysis remains descriptive and threshold-free');
