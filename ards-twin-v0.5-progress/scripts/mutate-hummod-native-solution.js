#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const { validateNativeHumModScenario }=require('../src/hummod_native_scenario.js');

function finite(value,label){
  const n=Number(value);
  if(!Number.isFinite(n)) throw new Error(label+' must be finite');
  return n;
}

function escapeRegex(text){ return text.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&'); }

function replaceSeries(text,name,value){
  const re=new RegExp('(<var>\\s*<name>\\s*'+escapeRegex(name)+'\\s*</name>)([\\s\\S]*?)(</var>)');
  const m=text.match(re);
  if(!m) throw new Error('native solution variable not found: '+name);
  const count=(m[2].match(/<val>/g)||[]).length;
  if(count===0) throw new Error('native solution variable has no values: '+name);
  const replacement='\n'+Array.from({length:count},()=>'<val> '+value+' </val>').join('\n')+'\n';
  return text.replace(re,m[1]+replacement+m[3]);
}

const input=process.argv[2], specPath=process.argv[3], output=process.argv[4];
if(!input||!specPath||!output){
  throw new Error('usage: node scripts/mutate-hummod-native-solution.js <input.SOLN> <scenario.json> <output.SOLN>');
}
const spec=validateNativeHumModScenario(JSON.parse(fs.readFileSync(specPath,'utf8')));
let text=fs.readFileSync(input,'utf8');
for(const [name,value] of Object.entries(spec.assignments)){
  text=replaceSeries(text,name,finite(value,'assignment '+name));
}
fs.writeFileSync(output,text);
console.log(JSON.stringify({
  schema:spec.schema,
  scenarioId:spec.id,
  scenarioClass:spec.scenarioClass||null,
  assignmentCount:Object.keys(spec.assignments).length,
  assignments:spec.assignments,
  sourceSolution:input,
  outputSolution:output,
  clinicalValidation:false,
},null,2));
