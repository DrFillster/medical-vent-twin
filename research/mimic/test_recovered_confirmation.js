'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const base=process.argv[2];assert(base,'derived directory required');
const out=path.join(base,'dev-cohort-perfusion-v1');
const selected=JSON.parse(fs.readFileSync(path.join(out,'summary.json'))).decisions.filter(x=>x.pass&&!x.inherited);
const r=fs.readFileSync(path.join(out,'recovered_120min.jsonl'),'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
assert.strictEqual(r.length,5,'confirmation incomplete');assert.strictEqual(new Set(r.map(x=>x.event_id)).size,5);
const prefit=new Map(JSON.parse(fs.readFileSync(path.join(base,'primary60_conservative_prefit.json'))).map(x=>[x.event_id,x]));
let hourPass=0,extendedPass=0,errors=0;
for(const x of r){assert(selected.some(s=>s.event_id===x.event_id));if(x.error){errors++;continue;}
 assert(x.replayError<.001);assert.deepStrictEqual(x.points.map(p=>p.sec),[24,900,1800,2700,3600,5400,7200]);assert(x.points.every(p=>Object.values(p).every(Number.isFinite)));
 const t=prefit.get(x.event_id).targets,b=x.points[0];
 for(const [i,g] of [[4,x.hourGate],[6,x.extendedGate]]){const f=x.points[i],failures=[];
 if(Math.abs(b.pco2-t.pco2)>8)failures.push('baselineCO2');if(Math.abs(b.po2-t.po2)>20)failures.push('baselineO2');
 if(Math.abs(f.pco2-b.pco2)>8)failures.push('driftCO2');if(Math.abs(f.po2-b.po2)>20)failures.push('driftO2');assert.deepStrictEqual(g.failures,failures);assert.strictEqual(g.pass,failures.length===0);}
 for(const [k,target] of [['pco2',t.pco2],['po2',t.po2],['pH',t.ph]]){assert(Math.abs(x.finalResidual[k]-(x.points[6][k]-target))<1e-9);assert(Math.abs(x.lateChange[k]-(x.points[6][k]-x.points[4][k]))<1e-9);}
 if(x.hourGate.pass)hourPass++;if(x.extendedGate.pass)extendedPass++;
}
console.log(JSON.stringify({verified:5,hourPass,extendedPass,errors,validation:false}));
