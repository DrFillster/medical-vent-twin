'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const out=process.argv[2],parent=process.argv[3];if(!out||!parent)throw Error('required refinement and parent folders');
const m=JSON.parse(fs.readFileSync(path.join(out,'manifest.json'))),{fingerprint,...payload}=m;
assert.strictEqual(crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex'),fingerprint);
const previous=fs.readFileSync(path.join(parent,'results.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
assert.strictEqual(crypto.createHash('sha256').update(fs.readFileSync(path.join(parent,'results.jsonl'))).digest('hex'),m.parentLedgerHash);
const p=path.join(out,'attempts.jsonl');const rows=fs.existsSync(p)?fs.readFileSync(p,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
const keys=new Set();
for(const x of rows){assert.strictEqual(x.fingerprint,fingerprint);const k=x.event_id+':'+x.vpf;assert(!keys.has(k));keys.add(k);assert(x.vpf>=.5&&x.vpf<=1);assert(previous.some(y=>y.event_id===x.event_id&&y.condition==='candidate_latent_sid'&&!y.gate?.pass));
 if(x.error)continue;
 const c=x.candidate;assert.strictEqual(c.vpf,x.vpf);assert.deepStrictEqual(c.points.map(y=>y.sec),[24,900,1800,2700,3600]);assert(c.points.every(y=>Object.values(y).every(Number.isFinite)));
 const pass=Math.abs(c.baselineCO2)<=8&&Math.abs(c.baselineO2)<=20&&Math.abs(c.driftCO2)<=8&&Math.abs(c.driftO2)<=20;assert.strictEqual(x.gate.pass,pass);
}
const sp=path.join(out,'summary.json');if(fs.existsSync(sp)){const s=JSON.parse(fs.readFileSync(sp));assert.strictEqual(s.fingerprint,fingerprint);assert(s.completedCases<=19);assert.strictEqual(new Set(s.decisions.map(x=>x.event_id)).size,s.completedCases);for(const d of s.decisions){if(d.inherited)assert(previous.some(x=>x.event_id===d.event_id&&x.condition==='candidate_latent_sid'&&x.gate.pass));if(d.result?.selected)assert(d.result.attempts.some(a=>a.gate?.pass&&a.candidate.vpf===d.result.selected.vpf));}}
console.log(JSON.stringify({status:'refinement manifest/parent hash, attempts, bounds, checkpoints, coupled gates and decisions pass',verifiedAttempts:rows.length}));
