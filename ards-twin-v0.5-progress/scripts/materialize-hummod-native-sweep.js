#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const input=process.argv[2], outDir=process.argv[3];
if(!input||!outDir) throw new Error('usage: node scripts/materialize-hummod-native-sweep.js <sweep.json> <output-dir>');
const sweep=JSON.parse(fs.readFileSync(input,'utf8'));
if(sweep.schema!=='vent-hummod-native-sweep/v1') throw new Error('unsupported sweep schema');
fs.mkdirSync(outDir,{recursive:true});
const all=[{id:'baseline',mechanism:'baseline',assignments:sweep.baseline.assignments},...sweep.cases];
for(const item of all){
  const scenario={
    schema:'vent-hummod-native-scenario/v1',
    id:sweep.id+'--'+item.id,
    scenarioClass:item.id==='baseline'?'engineering-native-baseline':'engineering-pulmonary-injury-sensitivity',
    description:item.mechanism,
    assignments:item.assignments,
    provenance:{
      clinicalValidation:false,
      ardsScenario:false,
      sweepId:sweep.id,
      mechanism:item.mechanism,
      upstreamRepository:sweep.provenance.upstreamRepository,
      upstreamRevision:sweep.provenance.upstreamRevision,
      rationale:sweep.provenance.rationale,
    },
  };
  fs.writeFileSync(path.join(outDir,item.id+'.json'),JSON.stringify(scenario,null,2)+'\n');
}
console.log(JSON.stringify({sweepId:sweep.id,caseCount:all.length,cases:all.map(x=>x.id),clinicalValidation:false},null,2));
