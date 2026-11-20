'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto'),os=require('os'),cp=require('child_process');
const args=process.argv.slice(2),base=args[0],out=args[1];
if(!base||!out)throw Error('usage: test_development_batch.js DATA_DIR OUTPUT_DIR');
const manifest=JSON.parse(fs.readFileSync(path.join(out,'manifest.json')));
const {fingerprint,...payload}=manifest;
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
assert.strictEqual(sha(Buffer.from(JSON.stringify(payload))),fingerprint);
for(const [name,hash] of Object.entries(manifest.inputs))assert.strictEqual(sha(fs.readFileSync(path.join(base,name))),hash);
assert.strictEqual(manifest.scope.composite,19);assert.strictEqual(manifest.scope.separateHistory,5);
const resultFile=path.join(out,'results.jsonl');
const rows=fs.existsSync(resultFile)?fs.readFileSync(resultFile,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
const keys=new Set();
for(const r of rows){
 assert.strictEqual(r.fingerprint,fingerprint);assert(manifest.cohortIds.includes(r.event_id));assert(manifest.conditions.includes(r.condition));
 const key=r.event_id+':'+r.condition;assert(!keys.has(key));keys.add(key);
 if(!r.error){assert.deepStrictEqual(r.points.map(x=>x.sec),manifest.checkpoints);assert(r.points.every(x=>Object.values(x).every(Number.isFinite)));
 const m=r.metrics,pass=Math.abs(m.baselineCO2)<=8&&Math.abs(m.baselineO2)<=20&&Math.abs(m.driftCO2)<=8&&Math.abs(m.driftO2)<=20;assert.strictEqual(r.gate.pass,pass);}
}
// A foreign manifest must be rejected before simulation. No patient rows copied.
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'hummod-batch-contract-'));
try{
 fs.writeFileSync(path.join(temp,'manifest.json'),JSON.stringify({fingerprint:'foreign-context'}));
 const p=cp.spawnSync(process.execPath,[path.join(__dirname,'run_development_batch.js'),'--data-dir',base,'--out-dir',temp],{encoding:'utf8'});
 assert.notStrictEqual(p.status,0);assert(p.stderr.includes('context changed'));assert(!fs.existsSync(path.join(temp,'results.jsonl')));
}finally{fs.rmSync(temp,{recursive:true,force:true});}
console.log(JSON.stringify({status:'manifest/input hashes, cohort separation, ledger integrity, gate and context-mismatch rejection pass',verifiedCompletedRows:rows.length,plannedRows:38,complete:rows.length===38}));
