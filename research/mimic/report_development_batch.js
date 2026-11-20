'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const out=process.argv[2];if(!out)throw Error('required output directory');
const m=JSON.parse(fs.readFileSync(path.join(out,'manifest.json')));
const rows=fs.readFileSync(path.join(out,'results.jsonl'),'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
assert.strictEqual(rows.length,m.cohortIds.length*m.conditions.length,'batch incomplete; no final cohort report');
const seen=new Set();for(const x of rows){assert.strictEqual(x.fingerprint,m.fingerprint);const k=x.event_id+':'+x.condition;assert(!seen.has(k));seen.add(k);}
const paired={bothPass:0,improved:0,regressed:0,bothFail:0,errorPairs:0};
const details=[];
for(const id of m.cohortIds){const a=rows.find(x=>x.event_id===id&&x.condition==='original_fixed_sid'),b=rows.find(x=>x.event_id===id&&x.condition==='candidate_latent_sid');assert(a&&b);if(a.error||b.error){paired.errorPairs++;continue;}if(a.gate.pass&&b.gate.pass)paired.bothPass++;else if(!a.gate.pass&&b.gate.pass)paired.improved++;else if(a.gate.pass&&!b.gate.pass)paired.regressed++;else paired.bothFail++;details.push({event_id:id,originalPass:a.gate.pass,candidatePass:b.gate.pass,failures:b.gate.failures,finalCO2Error:b.finalCO2Error,finalO2Error:b.metrics.finalO2,phResidual:b.metrics.phResidual,late:b.late});}
const conditions={};for(const c of m.conditions){const a=rows.filter(x=>x.condition===c),failures={};for(const x of a)for(const k of x.gate?.failures||[])failures[k]=(failures[k]||0)+1;conditions[c]={denominator:a.length,pass:a.filter(x=>x.gate?.pass).length,error:a.filter(x=>x.error).length,failures};}
const report={fingerprint:m.fingerprint,developmentOnly:true,validation:false,conditions,paired,originalReplayMismatches:rows.filter(x=>x.condition==='original_fixed_sid'&&x.originalReplayPassMatches===false).length,details};
fs.writeFileSync(path.join(out,'cohort_report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
const lines=['# Development cohort baseline report','', 'Development qualification only; no intervention validation.','',`Composite cohort: ${m.cohortIds.length}; separate history pathway: ${m.scope.separateHistory}.`,'','No nuisance refitting; candidate combines latent SID and alternative initialization.',''];
for(const [c,v] of Object.entries(conditions))lines.push(`${c}: ${v.pass}/${v.denominator} pass; ${v.error} errors.`, `Failure components: ${JSON.stringify(v.failures)}.`,'');
lines.push(`Paired comparison: ${JSON.stringify(paired)}.`,`Original recorded pass mismatches: ${report.originalReplayMismatches}.`,'','Original replay mismatch requires investigation before attributing improvement to the new pathway.','Operational errors stay in denominators. No refinement or validation outcome access.');
fs.writeFileSync(path.join(out,'cohort_report.md'),lines.join('\n')+'\n',{flag:'wx'});
console.log(JSON.stringify({conditions,paired,originalReplayMismatches:report.originalReplayMismatches}));
