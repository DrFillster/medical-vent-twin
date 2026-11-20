'use strict';
const fs=require('fs'),assert=require('assert'),{gate}=require('./bounded_perfusion_refiner');
const b='/Users/philipbernard/mimic-data/derived/';
const r=JSON.parse(fs.readFileSync(b+'bounded_perfusion_refiner_regression.json'));
const sweep=JSON.parse(fs.readFileSync(b+'oxygen_capacity_fixed_sid_co2.json'));
const old=JSON.parse(fs.readFileSync(b+'oxygen_capacity_bracket_midpoints.json'));
assert.strictEqual(r.rows.length,2);assert.strictEqual(r.provenance.post_index_data_loaded,false);
for(const row of r.rows){
 const x=row.result,prior=old.rows.find(y=>y.event_id===row.event_id);
 assert.strictEqual(x.status,'pass');assert.strictEqual(x.evaluations,1);
 assert.strictEqual(x.attempts.length,9);assert.strictEqual(x.selected.vpf,prior.pars.vpf);
 assert.deepStrictEqual(x.attempts.filter(y=>y.source==='seed').map(y=>y.candidate.vpf),sweep.rows.filter(y=>y.event_id===row.event_id).map(y=>y.pars.vpf));
 const a=x.selected,p=a.points;
 assert.deepStrictEqual(p.map(y=>y.sec),[24,900,1800,2700,3600]);
 assert.deepStrictEqual(gate(a),{pass:true,failures:[]});
 const oldB=prior.points[0].gas,oldF=prior.points[4].gas;
 for(const [k,expected] of [['driftCO2',oldF.paco2MmHg-oldB.paco2MmHg],['driftO2',oldF.pao2MmHg-oldB.pao2MmHg],['baselineCO2',oldB.paco2MmHg-prior.targets.pco2],['baselineO2',oldB.pao2MmHg-prior.targets.po2]])assert(Math.abs(a[k]-expected)<0.001);
 for(const attempt of x.attempts){assert.deepStrictEqual(attempt.gate,gate(attempt.candidate));}
 assert(row.replayError<0.001);
}
console.log('ok - both generic model regressions, complete seeds/attempts, independent coupled replay and gates');
