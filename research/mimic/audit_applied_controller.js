'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const {sessionFor,setAlternative}=require('./development_model_adapter');
const base=process.argv[2];assert(base,'derived directory required');
const dir=path.join(base,'dev-qualified-prediction-v1'),raw=fs.readFileSync(path.join(dir,'predictions.jsonl'));
const rows=raw.toString().trim().split('\n').map(JSON.parse);assert.strictEqual(rows.length,20);
const prefits=new Map(JSON.parse(fs.readFileSync(path.join(base,'primary60_conservative_prefit.json'))).map(e=>[e.event_id,e]));
const report={engineeringOnly:true,validation:false,parentPredictionHash:crypto.createHash('sha256').update(raw).digest('hex'),runnerHash:crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'),freshShortReplays:true,originalPredictionsUnchanged:true,records:[]};
setAlternative(true);
for(const r of rows){const record={event_id:r.event_id,arm:r.arm};
 try{const e=prefits.get(r.event_id),s=sessionFor(e,r.pars);s.initialize();const snap=s.snapshot();record.initialSettings=snap.ventilator;
 assert.strictEqual(snap.ventilator.fio2,r.preFio2/100);assert.strictEqual(snap.ventilator.mode,'PS');
 if(r.arm==='observed_fio2_change')s.requestVentilationChange({mode:'PS',fio2:r.postFio2/100,peep:e.vent.peep,rr:2,pressureSupportCmH2O:e.vent.psv});
 record.requestPending=s.snapshot().ventilatorChangePending;
 record.checkpoints=[];
 for(let sec=1;sec<=30;sec++){s.runFor(1);const p=s.snapshot();record.checkpoints.push({sec,timeSec:p.timeSec,pending:p.ventilatorChangePending,settings:p.ventilator});}
 const final=record.checkpoints[29];assert.strictEqual(final.pending,false);assert.strictEqual(final.settings.fio2,r.postFio2/100);assert.strictEqual(final.settings.mode,'PS');
 for(const p of record.checkpoints){assert.strictEqual(p.settings.peepCmH2O,record.initialSettings.peepCmH2O);assert.strictEqual(p.settings.pressureSupportCmH2O,record.initialSettings.pressureSupportCmH2O);assert.strictEqual(p.settings.backupRatePerMin,record.initialSettings.backupRatePerMin);}
 record.firstObservedAppliedSec=record.checkpoints.find(p=>!p.pending&&p.settings.fio2===r.postFio2/100)?.sec;
 record.pass=true;
 }catch(error){record.pass=false;record.error=String(error.message||error);}
 report.records.push(record);
}
report.pass=report.records.filter(x=>x.pass).length;report.fail=20-report.pass;
fs.writeFileSync(path.join(dir,'applied_controller_audit.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({verified:20,pass:report.pass,fail:report.fail,freshShortReplays:true,originalPredictionsUnchanged:true}));assert.strictEqual(report.fail,0);
