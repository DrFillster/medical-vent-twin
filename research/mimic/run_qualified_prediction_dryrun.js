'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const {sessionFor,setAlternative}=require('./development_model_adapter');
const base=process.argv[2];assert(base,'derived directory required');
const folder=path.join(base,'dev-cohort-perfusion-v1');
const load=n=>fs.readFileSync(n),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const summaryRaw=load(path.join(folder,'summary.json')),summary=JSON.parse(summaryRaw);assert.strictEqual(summary.completedCases,19);
const confirmationRaw=load(path.join(folder,'recovered_120min.jsonl')),confirm=confirmationRaw.toString().trim().split('\n').map(JSON.parse);assert.strictEqual(confirm.length,5);assert(confirm.every(x=>!x.error&&x.hourGate.pass&&x.extendedGate.pass));
const parentRaw=load(path.join(base,'dev-batch-baseline-v1/results.jsonl')),parent=parentRaw.toString().trim().split('\n').map(JSON.parse);
const prefitRaw=load(path.join(base,'primary60_conservative_prefit.json')),prefit=new Map(JSON.parse(prefitRaw).map(x=>[x.event_id,x]));
const qualified=summary.decisions.filter(x=>x.pass);assert.strictEqual(qualified.length,10);
const horizons=Array.from({length:12},(_,i)=>(i+1)*300);
const source=[];function walk(dir){for(const x of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,x.name);if(x.isDirectory())walk(p);else if(p.endsWith('.js'))source.push(p);}}walk(path.resolve(__dirname,'../../ards-twin-v1.0/src'));
for(const n of ['development_model_adapter.js','fit_controlled_mechanics.js','run_qualified_prediction_dryrun.js'])source.push(path.join(__dirname,n));source.sort();
const design={version:'qualified-development-prediction-dryrun-v1',summaryHash:hash(summaryRaw),confirmationHash:hash(confirmationRaw),parentHash:hash(parentRaw),prefitHash:hash(prefitRaw),sourceHash:hash(Buffer.from(JSON.stringify(source.map(p=>[path.basename(p),hash(load(p))])))),qualifiedIds:qualified.map(x=>x.event_id),excludedIds:summary.decisions.filter(x=>!x.pass).map(x=>x.event_id),horizons,arms:['observed_fio2_change','no_change'],interventionAt:'immediately after existing initializer; no additional settling',parametersRetuned:false,outcomesRead:false,validation:false,scope:'engineering dry run on development-selected cases; not an independent validation freeze'};
const fingerprint=hash(Buffer.from(JSON.stringify(design)));
const output=path.join(base,'dev-qualified-prediction-v1');fs.mkdirSync(output,{recursive:true});const mp=path.join(output,'manifest.json');
if(fs.existsSync(mp))assert.strictEqual(JSON.parse(load(mp)).fingerprint,fingerprint,'context mismatch');else fs.writeFileSync(mp,JSON.stringify({...design,fingerprint},null,2)+'\n',{flag:'wx'});
const op=path.join(output,'predictions.jsonl'),rows=fs.existsSync(op)?load(op).toString().trim().split('\n').filter(Boolean).map(JSON.parse):[];
const keys=new Set();for(const r of rows){assert.strictEqual(r.fingerprint,fingerprint);assert(!keys.has(r.event_id+':'+r.arm));keys.add(r.event_id+':'+r.arm);}
setAlternative(true);
for(const d of qualified){const e=prefit.get(d.event_id);assert.strictEqual(e.transition_itemid,223835);assert.strictEqual(e.vent.fio2_percent,e.transition_pre_value);assert(e.transition_post_value>=21&&e.transition_post_value<=100);const old=parent.find(x=>x.event_id===d.event_id&&x.condition==='candidate_latent_sid');const pars={...old.pars,vpf:d.inherited?old.pars.vpf:d.result.selected.vpf};
 for(const arm of design.arms){const key=d.event_id+':'+arm;if(keys.has(key))continue;const row={fingerprint,event_id:d.event_id,arm,pars,preFio2:e.transition_pre_value,postFio2:arm==='no_change'?e.transition_pre_value:e.transition_post_value};
 try{const s=sessionFor(e,pars);s.initialize();const init=s.snapshot().systemic.gasExchange;row.initial={pco2:init.paco2MmHg,po2:init.pao2MmHg,pH:init.pH};
 const next={mode:'PS',fio2:row.postFio2/100,peep:e.vent.peep,rr:2,pressureSupportCmH2O:e.vent.psv};
 if(arm!=='no_change')s.requestVentilationChange(next);
 row.predictions=[];let elapsed=0;for(const sec of horizons){while(elapsed<sec){const h=Math.min(30,sec-elapsed);s.runFor(h);s.compactTraceHistory(60);elapsed+=h;}const g=s.snapshot().systemic.gasExchange;assert([g.paco2MmHg,g.pao2MmHg,g.pH].every(Number.isFinite));row.predictions.push({sec,pco2:g.paco2MmHg,po2:g.pao2MmHg,pH:g.pH});}
 }catch(error){row.error=String(error.message||error);}
 fs.appendFileSync(op,JSON.stringify(row)+'\n');rows.push(row);keys.add(key);console.log(JSON.stringify({completed:rows.length,planned:20,arm,error:row.error||null}));
 }}
console.log(JSON.stringify({complete:true,arms:rows.length,errors:rows.filter(x=>x.error).length,outcomesRead:false,validation:false}));
