'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert');
const {sessionFor,fitSid,setAlternative}=require('./development_model_adapter');
const {gate}=require('./bounded_perfusion_refiner');
const args=process.argv.slice(2);const value=k=>{const i=args.indexOf(k);return i<0?null:args[i+1];};
const base=value('--data-dir'),out=value('--out-dir');
if(!base||!out)throw Error('required: --data-dir PATH --out-dir NEW_OR_MATCHING_DIRECTORY');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=name=>fs.readFileSync(path.join(base,name));
const files=['primary60_ps_fio2_prefit_index.jsonl','primary60_conservative_prefit.json','primary60_ps_fio2_composite_refit.jsonl'];
const raw=files.map(read),jsonl=b=>b.toString().trim().split('\n').filter(Boolean).map(JSON.parse);
const lock=jsonl(raw[0]),prefit=new Map(JSON.parse(raw[1]).map(x=>[x.event_id,x])),priorRows=jsonl(raw[2]);
const prior=new Map(priorRows.map(x=>[x.event_id,x]));assert.strictEqual(prior.size,priorRows.length,'duplicate prior');
const cohort=lock.filter(x=>x.oxygenation_source_plan==='composite_effective_oxygenation');
assert.strictEqual(cohort.length,19);assert.strictEqual(new Set(cohort.map(x=>x.event_id)).size,19);
for(const x of cohort){assert(prefit.has(x.event_id)&&prior.has(x.event_id));assert.strictEqual(x.hummod_mode,'PS');assert.strictEqual(x.deadspace_source_plan,'latent_prior_constrained');}
const sourcePaths=[];
function collect(dir){for(const d of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,d.name);if(d.isDirectory())collect(p);else if(p.endsWith('.js'))sourcePaths.push(p);}}
collect(path.resolve(__dirname,'../../ards-twin-v1.0/src'));
for(const name of ['development_model_adapter.js','bounded_perfusion_refiner.js','fit_controlled_mechanics.js','run_development_batch.js'])sourcePaths.push(path.join(__dirname,name));
sourcePaths.sort();
const sourceHash=sha(Buffer.from(JSON.stringify(sourcePaths.map(p=>[path.relative(path.resolve(__dirname,'../..'),p),sha(fs.readFileSync(p))]))));
const manifest={version:'development-batch-baseline-v1',sourceHash,inputs:Object.fromEntries(files.map((n,i)=>[n,sha(raw[i])])),cohortIds:cohort.map(x=>x.event_id),
 conditions:['original_fixed_sid','candidate_latent_sid'],horizonSec:3600,checkpoints:[24,900,1800,2700,3600],
 originalSid:0.040,originalInitialization:true,candidatePreservesSourceVenousPco2:true,
 nuisanceParametersRetuned:false,postIndexTruthRead:false,validation:false,phReportedNotGate:true,
 scope:{lockTotal:lock.length,composite:cohort.length,separateHistory:lock.filter(x=>x.oxygenation_source_plan==='history_decomposable').length,priorRows:priorRows.length}};
const fingerprint=sha(Buffer.from(JSON.stringify(manifest)));
fs.mkdirSync(out,{recursive:true});const manifestPath=path.join(out,'manifest.json');
if(fs.existsSync(manifestPath))assert.strictEqual(JSON.parse(fs.readFileSync(manifestPath)).fingerprint,fingerprint,'context changed; choose a new output directory');
else fs.writeFileSync(manifestPath,JSON.stringify({...manifest,fingerprint},null,2)+'\n',{flag:'wx'});
const resultPath=path.join(out,'results.jsonl');
const previous=fs.existsSync(resultPath)?jsonl(fs.readFileSync(resultPath)):[];
const keys=new Set();for(const x of previous){assert.strictEqual(x.fingerprint,fingerprint);const k=x.event_id+':'+x.condition;assert(!keys.has(k),'duplicate checkpoint');keys.add(k);}
const all=[...previous];
function summary(){const s={fingerprint,plannedRuns:38,completed:all.length,conditions:{},errors:all.filter(x=>x.error).length,validation:false,postIndexTruthRead:false};for(const condition of manifest.conditions){const rows=all.filter(x=>x.condition===condition);s.conditions[condition]={completed:rows.length,pass:rows.filter(x=>x.gate?.pass).length,fail:rows.filter(x=>x.gate&&!x.gate.pass).length,error:rows.filter(x=>x.error).length};}const tmp=path.join(out,'summary.tmp');fs.writeFileSync(tmp,JSON.stringify(s,null,2)+'\n');fs.renameSync(tmp,path.join(out,'summary.json'));return s;}
for(const item of cohort){for(const condition of manifest.conditions){
 const key=item.event_id+':'+condition;if(keys.has(key))continue;
 const row={fingerprint,event_id:item.event_id,condition};
 try{
  const e=prefit.get(item.event_id),old=prior.get(item.event_id),f=old.fitted;
  assert(f,'missing nuisance fit');setAlternative(condition==='candidate_latent_sid');
  const sid=condition==='original_fixed_sid'?0.040:fitSid(e)?.sid;
  assert(Number.isFinite(sid),'SID fit outside bounds');
  row.pars={sid,co2:f.effective_co2_elimination_fraction,vpf:f.effective_ventilated_perfusion_fraction};
  const session=sessionFor(e,row.pars);session.initialize();let elapsed=0;row.points=[];
  for(const sec of manifest.checkpoints){while(elapsed<sec){const h=Math.min(30,sec-elapsed);session.runFor(h);session.compactTraceHistory(60);elapsed+=h;}const g=session.snapshot().systemic.gasExchange;assert([g.paco2MmHg,g.pao2MmHg,g.pH].every(Number.isFinite));row.points.push({sec,pco2:g.paco2MmHg,po2:g.pao2MmHg,pH:g.pH});}
  const b=row.points[0],z=row.points[4];row.metrics={vpf:row.pars.vpf,baselineCO2:b.pco2-e.targets.pco2,baselineO2:b.po2-e.targets.po2,driftCO2:z.pco2-b.pco2,driftO2:z.po2-b.po2,finalO2:z.po2-e.targets.po2,phResidual:z.pH-e.targets.ph};row.gate=gate(row.metrics);
  row.finalCO2Error=z.pco2-e.targets.pco2;row.late={pco2:z.pco2-row.points[2].pco2,po2:z.po2-row.points[2].po2,pH:z.pH-row.points[2].pH};
  row.originalRecordedPass=old.pass;
  if(condition==='original_fixed_sid')row.originalReplayPassMatches=row.gate.pass===old.pass;
 }catch(error){row.error=String(error.message||error);}
 fs.appendFileSync(resultPath,JSON.stringify(row)+'\n');all.push(row);keys.add(key);const s=summary();console.log(JSON.stringify({completed:s.completed,planned:s.plannedRuns,condition,pass:row.gate?.pass,error:row.error||null}));
}}
console.log(JSON.stringify(summary()));
