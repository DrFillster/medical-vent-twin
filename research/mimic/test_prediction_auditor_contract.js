'use strict';
// Synthetic engineering fixtures only; no clinical measurements.
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process'),assert=require('assert'),crypto=require('crypto');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'hummod-prediction-audit-'));
const dirs=['dev-qualified-prediction-v1','dev-batch-baseline-v1','dev-cohort-perfusion-v1'];for(const d of dirs)fs.mkdirSync(path.join(tmp,d));
const data={qualifiedIds:Array.from({length:10},(_,i)=>'synthetic-'+i),arms:['observed_fio2_change','no_change'],horizons:[3600]};
const fingerprint=crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
fs.writeFileSync(path.join(tmp,dirs[0],'manifest.json'),JSON.stringify({...data,fingerprint}));
const rows=[],old=[];for(const id of data.qualifiedIds){old.push({event_id:id,condition:'candidate_latent_sid',points:[{sec:3600,pco2:0,po2:0,pH:0}]});for(const arm of data.arms)rows.push({fingerprint,event_id:id,arm,pars:{testOnly:true},initial:{testOnly:true},preFio2:40,postFio2:arm==='no_change'?40:50,predictions:Array.from({length:12},()=>({sec:3600,pco2:0,po2:0,pH:0}))});}
// Auditor's current real batch has twelve checkpoints, not one.
data.horizons=Array.from({length:12},(_,i)=>(i+1)*300);
const fp=crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');fs.writeFileSync(path.join(tmp,dirs[0],'manifest.json'),JSON.stringify({...data,fingerprint:fp}));for(const r of rows){r.fingerprint=fp;r.predictions.forEach((p,i)=>p.sec=data.horizons[i]);}
const lines=a=>a.map(x=>JSON.stringify(x)).join('\n')+'\n';fs.writeFileSync(path.join(tmp,dirs[1],'results.jsonl'),lines(old));fs.writeFileSync(path.join(tmp,dirs[2],'recovered_120min.jsonl'),'');
const pred=path.join(tmp,dirs[0],'predictions.jsonl'),report=path.join(tmp,dirs[0],'engineering_audit.json');
function run(r){fs.writeFileSync(pred,lines(r));if(fs.existsSync(report))fs.unlinkSync(report);return cp.spawnSync(process.execPath,[path.join(__dirname,'audit_qualified_prediction_dryrun.js'),tmp],{encoding:'utf8'});}
try{
 assert.strictEqual(run(rows).status,0,'complete synthetic pair audit');
 assert.notStrictEqual(run(rows.slice(1)).status,0,'incomplete must fail');
 const duplicate=JSON.parse(JSON.stringify(rows));duplicate[0]=duplicate[1];assert.notStrictEqual(run(duplicate).status,0,'duplicate must fail');
 const mismatch=JSON.parse(JSON.stringify(rows));mismatch[1].predictions[11].po2=1;assert.notStrictEqual(run(mismatch).status,0,'replay mismatch must fail');
 const failed=JSON.parse(JSON.stringify(rows));failed[0].error='synthetic failure';assert.notStrictEqual(run(failed).status,0,'execution error must fail');
 console.log('ok - five prediction auditor contract tests: complete, partial, duplicate, replay mismatch, execution error');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
