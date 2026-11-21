'use strict';
// Outcome-blind selection by EXACT starting settings; no disease equivalence claim.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert');
const {sessionFor,setAlternative}=require('./development_model_adapter');
const b=process.argv[2],load=n=>fs.readFileSync(path.join(b,n),'utf8'),hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const raw=load('primary60_conservative_prefit.json'),p=new Map(JSON.parse(raw).map(x=>[x.event_id,x]));
const m=JSON.parse(load('dev-qualified-prediction-v1/manifest.json')),d=JSON.parse(load('dev-cohort-perfusion-v1/summary.json')).decisions;
const parent=load('dev-batch-baseline-v1/results.jsonl').trim().split('\n').map(JSON.parse);
const groups=new Map();for(const id of [...m.qualifiedIds,...m.excludedIds]){const e=p.get(id),key=JSON.stringify([e.hummod_mode,e.vent.peep,e.vent.psv,e.transition_pre_value]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(id);}
const selected=[...groups].filter(([k,v])=>v.length>=2).sort((a,b)=>a[0].localeCompare(b[0]));
const out=path.join(b,'dev-similar-settings-v1');fs.mkdirSync(out,{recursive:true});
const design={developmentOnly:true,selection:'all exact mode/PEEP/PS/starting-FiO2 groups with at least two cases among all 19; NOT physiological or disease matching',prefitHash:hash(raw),groups:selected.map(([key,ids])=>({key,ids})),arms:['unchanged','recorded_fio2'],durationSec:60,parametersRetuned:false,outcomesRead:false,usesLegacySavedFits:true,knownLimitations:['unresolved same-time input provenance','common reference template','not independent validation','baseline failures retained','not outcome accuracy scoring']};
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(design,null,2)+'\n',{flag:'wx'});setAlternative(true);
const rows=[];
for(const [key,ids]of selected)for(const id of ids){const e=p.get(id),dec=d.find(x=>x.event_id===id),old=parent.find(x=>x.event_id===id&&x.condition==='candidate_latent_sid');
 for(const arm of design.arms){let row={event_id:id,group:key,arm,baselineQualified:dec.pass};try{assert(old&&old.pars);const pars={...old.pars,vpf:dec.pass&&!dec.inherited?dec.result.selected.vpf:old.pars.vpf};const s=sessionFor(e,pars);s.initialize();row.initial=s.snapshot().systemic.gasExchange;if(arm==='recorded_fio2')s.requestVentilationChange({mode:'PS',fio2:e.transition_post_value/100,peep:e.vent.peep,rr:2,pressureSupportCmH2O:e.vent.psv});for(let sec=0;sec<60;sec+=10){s.runFor(10);s.compactTraceHistory(60);}row.final=s.snapshot().systemic.gasExchange;assert([row.final.paco2MmHg,row.final.pao2MmHg,row.final.pH].every(Number.isFinite));row.pars=pars;}catch(err){row.error=err.message;}fs.appendFileSync(path.join(out,'runs.jsonl'),JSON.stringify(row)+'\n');rows.push(row);}
}
const summary={groups:selected.length,cases:selected.reduce((n,x)=>n+x[1].length,0),runs:rows.length,executionErrors:rows.filter(x=>x.error).length,baselineQualifiedCases:rows.filter(x=>x.arm==='unchanged'&&x.baselineQualified).length,baselineFailedCases:rows.filter(x=>x.arm==='unchanged'&&!x.baselineQualified).length,outcomeAccuracyEvaluated:false};fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
