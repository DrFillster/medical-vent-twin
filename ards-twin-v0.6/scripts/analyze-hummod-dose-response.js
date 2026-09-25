#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const summaryPath=process.argv[2], manifestPath=process.argv[3], outputPath=process.argv[4];
if(!summaryPath||!manifestPath||!outputPath) throw new Error('usage: node scripts/analyze-hummod-dose-response.js <sensitivity-summary.json> <sweep.json> <output.json>');
const summary=JSON.parse(fs.readFileSync(summaryPath,'utf8'));
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
if(summary.schema!=='vent-hummod-native-sensitivity-summary/v1') throw new Error('sensitivity summary required');
const rowByCase=new Map((summary.rows||[]).map(r=>[r.case,r]));
const baseline=summary.baselineEndpoints;

function endpoint(row,key,deltaKey){return baseline[key]+row[deltaKey];}
function monotonic(values,direction){
  if(values.length<2)return null;
  if(direction==='nondecreasing')return values.every((v,i)=>i===0||v>=values[i-1]);
  if(direction==='nonincreasing')return values.every((v,i)=>i===0||v<=values[i-1]);
  return null;
}

const families=(manifest.doseResponseFamilies||[]).map(f=>{
  const points=f.caseIds.map(id=>{
    const row=rowByCase.get(id);
    if(!row) throw new Error('dose-response case missing from summary: '+id);
    const control=row.assignments&&row.assignments[f.controlSymbol];
    if(typeof control!=='number'||!Number.isFinite(control)) throw new Error('dose-response control missing for '+id+': '+f.controlSymbol);
    return {
      case:id,
      control,
      endpoints:{
        paO2:endpoint(row,'paO2','deltaPaO2'),
        paCO2:endpoint(row,'paCO2','deltaPaCO2'),
        pH:endpoint(row,'pH','deltaPH'),
        map:endpoint(row,'map','deltaMAP'),
        cardiacOutput:endpoint(row,'cardiacOutput','deltaCardiacOutput'),
      },
    };
  }).sort((a,b)=>a.control-b.control);
  return {
    id:f.id,
    controlSymbol:f.controlSymbol,
    engineeringDirection:f.engineeringDirection,
    points,
    observedMonotonicity:{
      paO2Nonincreasing:monotonic(points.map(p=>p.endpoints.paO2),'nonincreasing'),
      paO2Nondecreasing:monotonic(points.map(p=>p.endpoints.paO2),'nondecreasing'),
      paCO2Nonincreasing:monotonic(points.map(p=>p.endpoints.paCO2),'nonincreasing'),
      paCO2Nondecreasing:monotonic(points.map(p=>p.endpoints.paCO2),'nondecreasing'),
    },
  };
});
const report={
  schema:'vent-hummod-native-dose-response/v1',
  baselineEndpoints:baseline,
  families,
  interpretation:'engineering-dose-response-only; monotonicity is descriptive and does not establish ARDS validity or clinical dose-response',
  berlinArdsCalibration:false,
  clinicalValidation:false,
};
fs.writeFileSync(outputPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
