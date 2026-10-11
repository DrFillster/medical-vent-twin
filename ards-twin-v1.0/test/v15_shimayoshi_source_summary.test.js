'use strict';
const assert=require('node:assert/strict');
const {summarizeRun}=require('../scripts/summarize-shimayoshi-source-run.js');
const row=(time_s,protocol,fb,ratio,pHi)=>({
  time_s,protocol,peak_Fb_mN_per_mm2:fb,stress_ratio:ratio,
  end_cycle_pHi:pHi,peak_Cyt_Cai_mM:0.001,end_cycle_ATPTotal_mM:6,
  end_cycle_PCr_mM:10,end_cycle_Pi_mM:2,
});
const run={
  status:'shimayoshi-source-stress-trajectory-validated',
  referencePeakStressMnPerMm2:6,
  trajectory:[
    row(299.6,'control',6,1,7.14),
    row(300.0,'acidosis',5.8,0.9667,7.13),
    row(900.0,'control',5.0,0.8333,6.9),
    row(960.0,'control',5.5,0.9167,7.0),
  ],
  provenance:{protocolName:'acidosis'}
};
const x=summarizeRun(run);
assert.deepEqual(x.phases,['control','acidosis']);
assert.equal(x.phaseSummaries.acidosis.minPeakFb.peak_Fb_mN_per_mm2,5.8);
assert.equal(x.checkpoints['960'].time_s,960);
console.log('ok - Shimayoshi source trajectory summarizer preserves phase and checkpoint values');
