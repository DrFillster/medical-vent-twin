'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const base=process.argv[2],folder=path.join(base,'dev-qualified-prediction-v1');
const m=JSON.parse(fs.readFileSync(path.join(folder,'manifest.json'))),{fingerprint,...payload}=m;
assert.strictEqual(crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex'),fingerprint);
const lines=p=>fs.readFileSync(p,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
const rows=lines(path.join(folder,'predictions.jsonl'));
assert.strictEqual(rows.length,20,'prediction batch incomplete');const keys=new Set();
for(const x of rows){assert.strictEqual(x.fingerprint,fingerprint);assert(m.qualifiedIds.includes(x.event_id));assert(m.arms.includes(x.arm));const k=x.event_id+':'+x.arm;assert(!keys.has(k));keys.add(k);if(x.error)continue;assert.deepStrictEqual(x.predictions.map(p=>p.sec),m.horizons);assert(x.predictions.every(p=>Object.values(p).every(Number.isFinite)));}
const parent=lines(path.join(base,'dev-batch-baseline-v1/results.jsonl'));
const recovered=lines(path.join(base,'dev-cohort-perfusion-v1/recovered_120min.jsonl'));
const report={fingerprint,developmentOnly:true,validation:false,outcomesRead:false,errors:rows.filter(x=>x.error).length,completedPairs:0,noChangeReplayFailures:[],pairs:[]};
for(const id of m.qualifiedIds){
 const a=rows.find(x=>x.event_id===id&&x.arm==='observed_fio2_change'),b=rows.find(x=>x.event_id===id&&x.arm==='no_change');assert(a&&b);if(a.error||b.error)continue;
 assert.deepStrictEqual(a.pars,b.pars);assert.deepStrictEqual(a.initial,b.initial);assert.strictEqual(b.preFio2,b.postFio2);
 const old=recovered.find(x=>x.event_id===id)||parent.find(x=>x.event_id===id&&x.condition==='candidate_latent_sid');
 const target=old.points.find(x=>x.sec===3600),n=b.predictions[11],changed=a.predictions[11];
 const replayError=Math.max(...['pco2','po2','pH'].map(k=>Math.abs(n[k]-target[k])));
 if(replayError>.001)report.noChangeReplayFailures.push({event_id:id,replayError});
 report.pairs.push({event_id:id,fio2Change:a.postFio2-a.preFio2,at60minDifference:{pco2:changed.pco2-n.pco2,po2:changed.po2-n.po2,pH:changed.pH-n.pH},noChangeReplayError:replayError});report.completedPairs++;
}
fs.writeFileSync(path.join(folder,'engineering_audit.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(report));
assert.strictEqual(report.errors,0,'simulation errors');assert.strictEqual(report.noChangeReplayFailures.length,0,'no-change replay differs; investigate before scoring');
