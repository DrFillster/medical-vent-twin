'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const out=process.argv[2];assert(out,'required refinement output folder');
const s=JSON.parse(fs.readFileSync(path.join(out,'summary.json')));
assert.strictEqual(s.completedCases,19,'refinement incomplete; no final cohort report');
assert.strictEqual(s.decisions.length,19);assert.strictEqual(new Set(s.decisions.map(x=>x.event_id)).size,19);
const rows=fs.readFileSync(path.join(out,'attempts.jsonl'),'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
assert(rows.every(x=>x.fingerprint===s.fingerprint));
const report={fingerprint:s.fingerprint,developmentOnly:true,validation:false,denominator:19,
 inheritedPasses:s.decisions.filter(x=>x.inherited).length,newPasses:s.decisions.filter(x=>!x.inherited&&x.pass).length,
 unresolved:s.decisions.filter(x=>!x.pass).length,simulations:rows.length,simulationErrors:rows.filter(x=>x.error).length,
 unresolvedReasons:{},selectedFits:s.decisions.filter(x=>x.result?.selected).map(x=>({event_id:x.event_id,vpf:x.result.selected.vpf,baselineCO2:x.result.selected.baselineCO2,baselineO2:x.result.selected.baselineO2,driftCO2:x.result.selected.driftCO2,driftO2:x.result.selected.driftO2,finalO2:x.result.selected.finalO2,finalCO2:x.result.selected.finalCO2,phResidual:x.result.selected.phResidual}))};
for(const d of s.decisions.filter(x=>!x.pass)){const k=d.status||d.result?.status||'unknown';report.unresolvedReasons[k]=(report.unresolvedReasons[k]||0)+1;}
assert.strictEqual(report.inheritedPasses+report.newPasses+report.unresolved,19);
report.ledgerSha256=crypto.createHash('sha256').update(fs.readFileSync(path.join(out,'attempts.jsonl'))).digest('hex');
fs.writeFileSync(path.join(out,'cohort_refinement_report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({...report,selectedFits:undefined}));
