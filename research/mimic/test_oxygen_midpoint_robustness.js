'use strict';
const fs=require('fs'),assert=require('assert');
const b='/Users/philipbernard/mimic-data/derived/';
const r=JSON.parse(fs.readFileSync(b+'oxygen_midpoint_robustness.json'));
const inputs=JSON.parse(fs.readFileSync(b+'oxygen_capacity_bracket_midpoints.json'));
assert.strictEqual(r.rows.length,6);
assert.strictEqual(r.provenance.post_index_data_loaded,false);
assert.strictEqual(r.provenance.parameters_retuned,false);
for(const input of inputs.rows){
 const rows=r.rows.filter(x=>x.event_id===input.event_id);
 assert.deepStrictEqual(rows.map(x=>x.offset),[0,-0.005,0.005]);
 for(const x of rows){
  assert.strictEqual(x.pars.vpf,input.pars.vpf+x.offset);
  assert.strictEqual(x.pars.sid,input.pars.sid);assert.strictEqual(x.pars.co2,input.pars.co2);
  assert.deepStrictEqual(x.points.map(p=>p.sec),[24,900,1800,2700,3600,5400,7200]);
  if(x.offset===0)assert(x.replayError<0.001);
  const baseline=x.points[0].gas;
  for(const [index,residual] of [[4,x.hourResidual],[6,x.extendedResidual]]){
   const f=x.points[index].gas,t=input.targets;
   assert(Math.abs(residual.pco2-(f.paco2MmHg-t.pco2))<1e-9);
   assert(Math.abs(residual.po2-(f.pao2MmHg-t.po2))<1e-9);
   assert(Math.abs(residual.pH-(f.pH-t.ph))<1e-9);
  }
  for(const k of ['paco2MmHg','pao2MmHg','pH'])assert(Math.abs(x.late[k]-(x.points[6].gas[k]-x.points[4].gas[k]))<1e-9);
  for(const [index,gate] of [[4,x.hourGate],[6,x.extendedGate]]){
   const f=x.points[index].gas,t=input.targets,failures=[];
   if(Math.abs(baseline.paco2MmHg-t.pco2)>8)failures.push('baseline_CO2');
   if(Math.abs(baseline.pao2MmHg-t.po2)>20)failures.push('baseline_O2');
   if(Math.abs(f.paco2MmHg-baseline.paco2MmHg)>8)failures.push('drift_CO2');
   if(Math.abs(f.pao2MmHg-baseline.pao2MmHg)>20)failures.push('drift_O2');
   assert.deepStrictEqual(gate.failures,failures);assert.strictEqual(gate.pass,failures.length===0);
  }
  for(const p of x.points){assert.strictEqual(p.gas.ventilatedPerfusionFraction,x.pars.vpf);assert([p.gas.paco2MmHg,p.gas.pao2MmHg,p.gas.pH].every(Number.isFinite));}
 }
}
console.log('ok - six extended sensitivity trajectories, fixed inputs, center replay, finite states and independent gate checks');
