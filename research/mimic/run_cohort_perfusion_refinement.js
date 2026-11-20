'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert');
const {sessionFor,setAlternative}=require('./development_model_adapter');
const {refine,gate}=require('./bounded_perfusion_refiner');
const argv=process.argv.slice(2),arg=k=>argv[argv.indexOf(k)+1];
for(const k of ['--data-dir','--parent-dir','--out-dir'])assert(argv.includes(k),'required '+k);
const base=arg('--data-dir'),parent=arg('--parent-dir'),out=arg('--out-dir');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const jsonl=p=>fs.readFileSync(p,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
const pm=JSON.parse(fs.readFileSync(path.join(parent,'manifest.json')));
const parentRaw=fs.readFileSync(path.join(parent,'results.jsonl')),previous=jsonl(path.join(parent,'results.jsonl'));
assert.strictEqual(previous.length,38,'parent incomplete');
for(const [n,h] of Object.entries(pm.inputs))assert.strictEqual(sha(fs.readFileSync(path.join(base,n))),h,'parent input changed');
const prefits=new Map(JSON.parse(fs.readFileSync(path.join(base,'primary60_conservative_prefit.json'))).map(x=>[x.event_id,x]));
const candidates=previous.filter(x=>x.condition==='candidate_latent_sid');assert.strictEqual(candidates.length,19);
const sourceFiles=[];function walk(d){for(const x of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,x.name);if(x.isDirectory())walk(p);else if(p.endsWith('.js'))sourceFiles.push(p);}}
walk(path.resolve(__dirname,'../../ards-twin-v1.0/src'));
const parentFiles=[...sourceFiles,...['development_model_adapter.js','bounded_perfusion_refiner.js','fit_controlled_mechanics.js','run_development_batch.js'].map(n=>path.join(__dirname,n))].sort();
const parentSource=sha(Buffer.from(JSON.stringify(parentFiles.map(p=>[path.relative(path.resolve(__dirname,'../..'),p),sha(fs.readFileSync(p))]))));
assert.strictEqual(parentSource,pm.sourceHash,'parent source context changed');
const context={version:'cohort-perfusion-refinement-v1',parentFingerprint:pm.fingerprint,parentLedgerHash:sha(parentRaw),sourceHash:parentSource,runnerHash:sha(fs.readFileSync(__filename)),grid:[.5,.6,.7,.8,.85,.9,.95,1],maxRefinements:4,horizon:3600,conditions:'candidate latent SID/source venous PCO2 preserved',fixedSidDeadspaceMechanicsEffort:true,postIndexTruthRead:false,developmentOnly:true};
const fingerprint=sha(Buffer.from(JSON.stringify(context)));
fs.mkdirSync(out,{recursive:true});const mp=path.join(out,'manifest.json');
if(fs.existsSync(mp))assert.strictEqual(JSON.parse(fs.readFileSync(mp)).fingerprint,fingerprint,'context mismatch');else fs.writeFileSync(mp,JSON.stringify({...context,fingerprint},null,2)+'\n',{flag:'wx'});
const ledger=path.join(out,'attempts.jsonl');const saved=fs.existsSync(ledger)?jsonl(ledger):[];
const cache=new Map();for(const r of saved){assert.strictEqual(r.fingerprint,fingerprint);const k=r.event_id+':'+r.vpf;assert(!cache.has(k),'duplicate attempt');cache.set(k,r);}
const decisions=[];setAlternative(true);
function summarize(){const s={fingerprint,plannedCases:19,completedCases:decisions.length,pass:decisions.filter(x=>x.pass).length,unresolved:decisions.filter(x=>!x.pass).length,inheritedPasses:decisions.filter(x=>x.inherited).length,freshAttempts:cache.size,postIndexTruthRead:false,validation:false,decisions};const tmp=path.join(out,'summary.tmp');fs.writeFileSync(tmp,JSON.stringify(s,null,2)+'\n');fs.renameSync(tmp,path.join(out,'summary.json'));return s;}
for(const old of candidates){
 if(old.gate?.pass){decisions.push({event_id:old.event_id,pass:true,inherited:true,status:'parent_pass_not_rerun'});summarize();continue;}
 if(old.error){decisions.push({event_id:old.event_id,pass:false,status:'parent_error',error:old.error});summarize();continue;}
 const e=prefits.get(old.event_id);assert(e);
 function evaluate(vpf){
  const key=e.event_id+':'+vpf;
  if(cache.has(key)){const r=cache.get(key);if(r.error)throw Error(r.error);return r.candidate;}
  const record={fingerprint,event_id:e.event_id,vpf};
  try{
   const s=sessionFor(e,{...old.pars,vpf});s.initialize();let elapsed=0;const points=[];
   for(const sec of [24,900,1800,2700,3600]){while(elapsed<sec){const h=Math.min(30,sec-elapsed);s.runFor(h);s.compactTraceHistory(60);elapsed+=h;}const g=s.snapshot().systemic.gasExchange;assert([g.paco2MmHg,g.pao2MmHg,g.pH].every(Number.isFinite));assert.strictEqual(g.ventilatedPerfusionFraction,vpf);points.push({sec,pco2:g.paco2MmHg,po2:g.pao2MmHg,pH:g.pH});}
   const b=points[0],f=points[4];record.candidate={vpf,baselineCO2:b.pco2-e.targets.pco2,baselineO2:b.po2-e.targets.po2,driftCO2:f.pco2-b.pco2,driftO2:f.po2-b.po2,finalO2:f.po2-e.targets.po2,phResidual:f.pH-e.targets.ph,finalCO2:f.pco2-e.targets.pco2,points};record.gate=gate(record.candidate);
  }catch(error){record.error=String(error.message||error);}
  fs.appendFileSync(ledger,JSON.stringify(record)+'\n');cache.set(key,record);
  console.log(JSON.stringify({attempts:cache.size,completedCases:decisions.length,pass:record.gate?.pass,error:record.error||null}));
  if(record.error)throw Error(record.error);return record.candidate;
 }
 try{
  const values=[...new Set([...context.grid,old.pars.vpf])].sort((a,b)=>a-b);
  const seeds=values.map(evaluate);
  const result=refine({seeds,evaluate,maxEvaluations:context.maxRefinements});
  decisions.push({event_id:e.event_id,pass:result.status==='pass',inherited:false,result});
 }catch(error){decisions.push({event_id:e.event_id,pass:false,inherited:false,status:'evaluation_failed',error:String(error.message||error)});}
 const s=summarize();console.log(JSON.stringify({completedCases:s.completedCases,planned:19,pass:s.pass,unresolved:s.unresolved}));
}
const s=summarize();console.log(JSON.stringify({complete:true,pass:s.pass,unresolved:s.unresolved,attempts:s.freshAttempts}));
