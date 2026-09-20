#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const root=process.argv[2], output=process.argv[3]||path.join(root||'.','sensitivity-summary.json');
if(!root) throw new Error('usage: node scripts/summarize-hummod-native-sweep.js <sweep-output-dir> [output.json]');
const rows=[];
for(const entry of fs.readdirSync(root,{withFileTypes:true})){
  if(!entry.isDirectory()||entry.name==='baseline'||entry.name==='scenarios') continue;
  const p=path.join(root,entry.name,'comparison.json');
  if(!fs.existsSync(p)) continue;
  const c=JSON.parse(fs.readFileSync(p,'utf8'));
  const e=c.endpoints;
  rows.push({
    case:entry.name,
    deltaPaO2:e['PO2Artys.Pressure'].delta,
    deltaPaCO2:e['CO2Artys.Pressure'].delta,
    deltaPH:e['BloodPh.ArtysPh'].delta,
    deltaHeartRate:e['Heart-Rate.Rate'].delta,
    deltaMAP:e['SystemicArtys.Pressure'].delta,
    deltaCardiacOutput:e['CardiacOutput.Flow(L/Min)'].delta,
  });
}
if(!rows.length) throw new Error('no completed sweep comparisons found');
const report={
  schema:'vent-hummod-native-sensitivity-summary/v1',
  rows,
  interpretation:'engineering-sensitivity-only',
  berlinArdsCalibration:false,
  clinicalValidation:false,
};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
