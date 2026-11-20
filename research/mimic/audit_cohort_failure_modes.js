'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const out=process.argv[2];assert(out,'required completed baseline folder');
const m=JSON.parse(fs.readFileSync(path.join(out,'manifest.json')));
const rows=fs.readFileSync(path.join(out,'results.jsonl'),'utf8').trim().split('\n').map(JSON.parse).filter(x=>x.condition==='candidate_latent_sid');
assert.strictEqual(rows.length,19);assert(rows.every(x=>!x.error));
const groups={historicalPass:[],historicalFailFinalWithinComparator:[],finalOxygenMismatch:[],finalCO2Mismatch:[],finalBothMismatch:[]};
for(const x of rows){
 const co2=Math.abs(x.finalCO2Error)<=8,o2=Math.abs(x.metrics.finalO2)<=20;
 const category=x.gate.pass?'historicalPass':co2&&o2?'historicalFailFinalWithinComparator':co2?'finalOxygenMismatch':o2?'finalCO2Mismatch':'finalBothMismatch';
 groups[category].push({event_id:x.event_id,failures:x.gate.failures,finalCO2:x.finalCO2Error,finalO2:x.metrics.finalO2,late:x.late});
}
const report={parentFingerprint:m.fingerprint,developmentOnly:true,descriptiveOnly:true,
 comparator:'Existing 8/20 mmHg component limits applied to final absolute error ONLY for diagnostic grouping; not an added or replacement acceptance rule',counts:Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,v.length])),groups};
fs.writeFileSync(path.join(out,'failure_mode_audit.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({counts:report.counts,descriptiveOnly:true}));
