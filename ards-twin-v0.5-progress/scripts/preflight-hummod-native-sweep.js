#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const { validateNativeHumModSweep }=require('../src/hummod_native_sweep.js');

const solnPath=process.argv[2], sweepPath=process.argv[3], outputPath=process.argv[4];
if(!solnPath||!sweepPath||!outputPath) throw new Error('usage: node scripts/preflight-hummod-native-sweep.js <baseline.SOLN> <sweep.json> <output.json>');
const text=fs.readFileSync(solnPath,'utf8');
const sweep=validateNativeHumModSweep(JSON.parse(fs.readFileSync(sweepPath,'utf8')));

function decode(s){return s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&quot;/g,'\"').replace(/&apos;/g,"'");}
const variables=new Map();
const re=/<var>\s*<name>\s*([\s\S]*?)\s*<\/name>([\s\S]*?)<\/var>/g;
let m;
while((m=re.exec(text))!==null){
  const name=decode(m[1].trim());
  const values=[...m[2].matchAll(/<val>\s*([\s\S]*?)\s*<\/val>/g)].map(x=>Number(x[1].trim()));
  variables.set(name,values);
}

const requested=new Set();
for(const [k] of Object.entries(sweep.baseline.assignments)) requested.add(k);
for(const item of sweep.cases) for(const [k] of Object.entries(item.assignments)) requested.add(k);
const controls={};
for(const name of [...requested].sort()){
  const values=variables.get(name);
  if(!values||!values.length) throw new Error('baseline native solution missing sweep control: '+name);
  if(values.some(v=>!Number.isFinite(v))) throw new Error('baseline native solution has non-finite history: '+name);
  controls[name]={sampleCount:values.length,first:values[0],last:values[values.length-1]};
}

const tracked=[
 'System.X','PO2Artys.Pressure','CO2Artys.Pressure','BloodPh.ArtysPh',
 'Heart-Rate.Rate','SystemicArtys.Pressure','CardiacOutput.Flow(L/Min)',
 'AirSupply-InspiredAir.O2(%)','AirSupply-InspiredAir.PO2',
 'LungBloodFlow.AlveolarShunt','RightHemithorax.LungInflation','LeftHemithorax.LungInflation',
 'PulmonaryMembrane.Permeability','PulmonaryMembrane.DiffusingCapacity','PulmonaryMembrane.Thickness','PulmonaryMembrane.Recruitment'
];
const observables={};
for(const name of tracked){
  const values=variables.get(name);
  if(!values||!values.length) throw new Error('baseline native solution missing tracked observable: '+name);
  observables[name]={sampleCount:values.length,first:values[0],last:values[values.length-1]};
}

const report={
 schema:'vent-hummod-native-sweep-preflight/v1',
 sweepId:sweep.id,
 nativeVariableCount:variables.size,
 controlCount:requested.size,
 caseCount:sweep.cases.length+1,
 controls,
 baselineObservables:observables,
 peepRepresentation:'not-available-in-pinned-native-HumMod-ventilator',
 berlinClassificationAllowed:false,
 clinicalValidation:false,
 readyForOneShotWindowsRun:true,
};
fs.writeFileSync(outputPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
