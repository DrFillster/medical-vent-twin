'use strict';
const fs=require('fs'),assert=require('assert');
const base='/Users/philipbernard/mimic-data/derived/';
const sweep=JSON.parse(fs.readFileSync(base+'oxygen_capacity_fixed_sid_co2.json'));
const extended=JSON.parse(fs.readFileSync(base+'oxygen_capacity_best_extended.json'));
assert.strictEqual(extended.rows.length,2);
assert.strictEqual(extended.provenance.post_index_data_loaded,false);
for(const r of extended.rows){
 const best=sweep.rows.filter(x=>x.event_id===r.event_id).reduce((a,b)=>Math.abs(a.final.po2)<=Math.abs(b.final.po2)?a:b);
 assert.deepStrictEqual(r.pars,best.pars);
 assert(r.replayError<0.001);
 assert.deepStrictEqual(r.points.map(x=>x.sec),[24,900,1800,3600,5400,7200]);
 for(const p of r.points){
  assert.strictEqual(p.appliedVpf,r.pars.vpf);
  assert.strictEqual(p.gas.ventilatedPerfusionFraction,r.pars.vpf);
  for(const k of ['pao2MmHg','paco2MmHg','pH','alveolarPo2MmHg','endCapillaryPo2MmHg','oxygenUptakeMlPerMin'])assert(Number.isFinite(p.gas[k]));
 }
}
console.log('ok - two selected-candidate extensions, finite gas diagnostics, applied perfusion and replay');
