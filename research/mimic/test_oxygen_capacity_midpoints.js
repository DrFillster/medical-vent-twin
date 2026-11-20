'use strict';
const fs=require('fs'),assert=require('assert');
const base='/Users/philipbernard/mimic-data/derived/';
const sweep=JSON.parse(fs.readFileSync(base+'oxygen_capacity_fixed_sid_co2.json'));
const r=JSON.parse(fs.readFileSync(base+'oxygen_capacity_bracket_midpoints.json'));
assert.strictEqual(r.rows.length,2);assert.strictEqual(r.provenance.post_index_data_loaded,false);
for(const x of r.rows){
 const lo=sweep.rows.find(y=>y.event_id===x.event_id&&y.pars.vpf===x.bracket[0]);
 const hi=sweep.rows.find(y=>y.event_id===x.event_id&&y.pars.vpf===x.bracket[1]);
 assert(lo.final.po2*hi.final.po2<0);
 assert.strictEqual(x.pars.vpf,(x.bracket[0]+x.bracket[1])/2);
 assert.strictEqual(x.pars.sid,lo.pars.sid);assert.strictEqual(x.pars.co2,lo.pars.co2);
 assert.deepStrictEqual(x.points.map(y=>y.sec),[24,900,1800,2700,3600]);
 const b=x.points[0].gas,f=x.points[x.points.length-1].gas,t=x.targets;
 const pass=Math.abs(b.paco2MmHg-t.pco2)<=8&&Math.abs(b.pao2MmHg-t.po2)<=20&&Math.abs(f.paco2MmHg-b.paco2MmHg)<=8&&Math.abs(f.pao2MmHg-b.pao2MmHg)<=20;
 assert.strictEqual(x.pass,pass);
 for(const p of x.points){assert.strictEqual(p.gas.ventilatedPerfusionFraction,x.pars.vpf);assert([p.gas.pao2MmHg,p.gas.paco2MmHg,p.gas.pH].every(Number.isFinite));}
}
console.log('ok - two in-bounds bracket midpoints, fixed SID/CO2, applied overrides, finite states and gate');
