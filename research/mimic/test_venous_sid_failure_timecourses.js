'use strict';
const assert=require('assert'),fs=require('fs');
const b='/Users/philipbernard/mimic-data/derived/';
const r=JSON.parse(fs.readFileSync(b+'venous_sid_failure_timecourses.json','utf8'));
assert.strictEqual(r.rows.length,6);
assert.strictEqual(new Set(r.rows.map(x=>x.event_id)).size,3);
assert.strictEqual(r.provenance.post_index_data_loaded,false);
assert.strictEqual(r.provenance.new_parameter_fitting,false);
const times=[0,24,60,120,300,600,900,1800,2700,3600];
for(let i=0;i<6;i+=2){
  const a=r.rows[i],c=r.rows[i+1];
  assert.strictEqual(a.event_id,c.event_id);
  assert.strictEqual(a.transformed,false);assert.strictEqual(c.transformed,true);
  assert.deepStrictEqual(a.pars,c.pars);
  assert(a.replayError<0.001);
  for(const x of [a,c]){
    assert.deepStrictEqual(x.points.map(p=>p.sec),times);
    assert(x.points.every(p=>Object.values(p).every(Number.isFinite)));
    const f=[];
    if(Math.abs(x.baseline.pco2)>8)f.push('baseline_CO2');
    if(Math.abs(x.baseline.po2)>20)f.push('baseline_O2');
    if(Math.abs(x.drift.pco2)>8)f.push('drift_CO2');
    if(Math.abs(x.drift.po2)>20)f.push('drift_O2');
    assert.deepStrictEqual(x.failures,f);assert.strictEqual(x.pass,f.length===0);
  }
}
console.log('ok - three fixed pairs, finite checkpoints, replay, and unchanged gate');
