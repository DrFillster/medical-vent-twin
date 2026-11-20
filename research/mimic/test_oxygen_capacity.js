'use strict';
const fs=require('fs'),assert=require('assert');
const b='/Users/philipbernard/mimic-data/derived/';
const r=JSON.parse(fs.readFileSync(b+'oxygen_capacity_fixed_sid_co2.json','utf8'));
const source=JSON.parse(fs.readFileSync(b+'acid_base_joint_smoke_4.json','utf8')).filter(x=>!x.previous_pass).slice(1);
const grid=[0.5,0.6,0.7,0.8,0.85,0.9,0.95,1];
assert.strictEqual(r.rows.length,16);
assert.strictEqual(r.provenance.post_index_data_loaded,false);
for(const item of source){
 const rows=r.rows.filter(x=>x.event_id===item.event_id);
 assert.deepStrictEqual(rows.map(x=>x.pars.vpf),grid);
 assert.strictEqual(rows.filter(x=>x.replayError!==null).length,1);
 for(const x of rows){
  assert.strictEqual(x.pars.sid,item.fitted.latent_sid_mol_per_l);
  assert.strictEqual(x.pars.co2,item.fitted.effective_co2_elimination_fraction);
  assert.deepStrictEqual(x.points.map(p=>p.sec),[0,24,300,900,1800,2700,3600]);
  assert(x.points.every(p=>Object.values(p).every(Number.isFinite)));
  const pass=Math.abs(x.baseline.pco2)<=8&&Math.abs(x.baseline.po2)<=20&&Math.abs(x.drift.pco2)<=8&&Math.abs(x.drift.po2)<=20;
  assert.strictEqual(x.pass,pass);
 }
}
console.log('ok - 16 full-horizon candidates, unchanged grid, fixed SID/CO2, finite checkpoints and gate');
