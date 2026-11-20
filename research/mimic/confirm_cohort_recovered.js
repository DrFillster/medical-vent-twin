'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const {sessionFor,setAlternative}=require('./development_model_adapter');
const {gate}=require('./bounded_perfusion_refiner');
const base=process.argv[2];assert(base,'required derived data directory');
const folder=path.join(base,'dev-cohort-perfusion-v1');
const raw=fs.readFileSync(path.join(folder,'summary.json')),summary=JSON.parse(raw);
assert.strictEqual(summary.completedCases,19);
const parent=fs.readFileSync(path.join(base,'dev-batch-baseline-v1/results.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
const prefit=new Map(JSON.parse(fs.readFileSync(path.join(base,'primary60_conservative_prefit.json'))).map(x=>[x.event_id,x]));
const selected=summary.decisions.filter(x=>x.pass&&!x.inherited);assert.strictEqual(selected.length,5);
const out=path.join(folder,'recovered_120min.jsonl');assert(!fs.existsSync(out),'output exists; do not duplicate runs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
fs.writeFileSync(path.join(folder,'confirmation_design.json'),JSON.stringify({parentSummaryHash:sha(raw),runnerHash:sha(fs.readFileSync(__filename)),checkpoints:[24,900,1800,2700,3600,5400,7200],newFits:5,retuning:false,phNotGate:true,extendedGateDescriptive:true,validation:false},null,2)+'\n',{flag:'wx'});
setAlternative(true);
for(const d of selected){
 const row={event_id:d.event_id};
 try{
  const e=prefit.get(d.event_id),old=parent.find(x=>x.event_id===d.event_id&&x.condition==='candidate_latent_sid');
  row.pars={...old.pars,vpf:d.result.selected.vpf};
  const s=sessionFor(e,row.pars);s.initialize();let elapsed=0;row.points=[];
  for(const sec of [24,900,1800,2700,3600,5400,7200]){
   while(elapsed<sec){const h=Math.min(30,sec-elapsed);s.runFor(h);s.compactTraceHistory(60);elapsed+=h;}
   const g=s.snapshot().systemic.gasExchange;assert([g.paco2MmHg,g.pao2MmHg,g.pH].every(Number.isFinite));assert.strictEqual(g.ventilatedPerfusionFraction,row.pars.vpf);
   row.points.push({sec,pco2:g.paco2MmHg,po2:g.pao2MmHg,pH:g.pH});
  }
  const b=row.points[0],h=row.points[4],f=row.points[6];
  const metrics=p=>({vpf:row.pars.vpf,baselineCO2:b.pco2-e.targets.pco2,baselineO2:b.po2-e.targets.po2,driftCO2:p.pco2-b.pco2,driftO2:p.po2-b.po2,finalO2:p.po2-e.targets.po2,phResidual:p.pH-e.targets.ph});
  row.hourGate=gate(metrics(h));row.extendedGate=gate(metrics(f));
  row.replayError=Math.max(Math.abs(metrics(h).finalO2-d.result.selected.finalO2),Math.abs(metrics(h).driftCO2-d.result.selected.driftCO2),Math.abs(metrics(h).phResidual-d.result.selected.phResidual));assert(row.replayError<.001);
  row.finalResidual={pco2:f.pco2-e.targets.pco2,po2:f.po2-e.targets.po2,pH:f.pH-e.targets.ph};
  row.lateChange={pco2:f.pco2-h.pco2,po2:f.po2-h.po2,pH:f.pH-h.pH};
 }catch(error){row.error=String(error.message||error);}
 fs.appendFileSync(out,JSON.stringify(row)+'\n');console.log(JSON.stringify({completedCase:row.event_id,hour:row.hourGate,extended:row.extendedGate,error:row.error||null}));
}
