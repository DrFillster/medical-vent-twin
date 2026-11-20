'use strict';
// Local artifact integrity test; no patient rows are printed.
const assert=require('assert'),fs=require('fs');
const base='/Users/philipbernard/mimic-data/derived/';
const r=JSON.parse(fs.readFileSync(base+'venous_sid_timecourse_control.json','utf8'));
const old=JSON.parse(fs.readFileSync(base+'venous_sid_initialization_control.json','utf8'));
const e=JSON.parse(fs.readFileSync(base+'primary60_conservative_prefit.json','utf8')).find(x=>x.event_id==='FIT-102b833418f3');
assert.strictEqual(r.rows.length,6);
assert.strictEqual(r.provenance.post_index_data_loaded,false);
const times=[0,24,60,120,300,600,900,1800,2700,3600];
let maxEndpointError=0;
for(let i=0;i<6;i++){
  const x=r.rows[i],prior=old.rows[i];
  assert.strictEqual(x.label,prior.label);assert.strictEqual(x.transformed,prior.transformed);
  assert.deepStrictEqual(x.points.map(p=>p.sec),times);
  assert(x.points.every(p=>Object.values(p).every(Number.isFinite)));
  for(const [key,field,target] of [['pco2','pco2',e.targets.pco2],['po2','po2',e.targets.po2],['pH','ph',e.targets.ph]]){
    const b=x.points.find(p=>p.sec===24),f=x.points.find(p=>p.sec===3600);
    const expectedB=target+prior.residuals['baseline_'+field];
    const expectedF=expectedB+prior.residuals['drift_'+field+'_60'];
    const error=Math.max(Math.abs(b[key]-expectedB),Math.abs(f[key]-expectedF));
    maxEndpointError=Math.max(maxEndpointError,error);assert(error<0.001,'endpoint replay mismatch');
  }
}
console.log(JSON.stringify({status:'six trajectory artifacts verified',maxEndpointError}));
