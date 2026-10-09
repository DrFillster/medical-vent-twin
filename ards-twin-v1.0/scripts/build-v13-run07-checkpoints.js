#!/usr/bin/env node
'use strict';

const fs=require('node:fs');

const DEFAULT_FIELDS=[
  'System.X',
  'Heart-Rate.Rate',
  'CardiacOutput.Flow',
  'SANode-Rate.Rate',
  'SANode-Rate.Is_SinusRhythm',
  'Heart-Asystole.Is_Asystole',
  'LeftHeart-Flow.BloodFlow','RightHeart-Flow.BloodFlow',
  'LeftHeart-Flow.PO2','RightHeart-Flow.PO2',
  'LeftHeart-Metabolism.O2Use','RightHeart-Metabolism.O2Use',
  'LeftHeart-Metabolism.O2Need','RightHeart-Metabolism.O2Need',
  'LeftHeart-Metabolism.O2Lack','RightHeart-Metabolism.O2Lack',
  'LeftHeart-Metabolism.AnaerobicCals','RightHeart-Metabolism.AnaerobicCals',
  'LeftHeart-Fuel.FractUse','RightHeart-Fuel.FractUse',
  'LeftHeart-Fuel.FractUseDelay','RightHeart-Fuel.FractUseDelay',
  'LeftHeart-Lactate.[Lac-]','RightHeart-Lactate.[Lac-]',
  'LeftHeart-Ph.[SID]','RightHeart-Ph.[SID]',
  'LeftHeart-CO2.PCO2','RightHeart-CO2.PCO2',
  'LeftHeart-Ph.Ph','RightHeart-Ph.Ph',
  'LeftHeart-Function.PhEffect','RightHeart-Function.PhEffect',
  'LeftHeart-Function.FuelEffect','RightHeart-Function.FuelEffect',
  'LeftHeart-Function.Effect','RightHeart-Function.Effect',
  'LeftHeart-Function.Failed','RightHeart-Function.Failed'
];

function csvEscape(v){
  if(v==null) return '';
  const s=String(v);
  return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;
}

function build(input,windowSec=30){
  if(!input||input.format!=='lossless-numeric-extraction-of-native-SOLN'){
    throw new Error('lossless native HumMod extraction required');
  }
  const v=input.variables;
  if(!v||!Array.isArray(v['System.X'])) throw new Error('System.X required');
  const n=v['System.X'].length;
  const fields=DEFAULT_FIELDS.filter(k=>Array.isArray(v[k])&&v[k].length===n);
  if(!fields.includes('System.X')) throw new Error('System.X missing');
  const tSec=v['System.X'].map(x=>Number(x)*60);
  const asystole=Array.isArray(v['Heart-Asystole.Is_Asystole'])
    ? v['Heart-Asystole.Is_Asystole'].findIndex(x=>Number(x)!==0)
    : -1;
  const terminalIndex=asystole>=0?asystole:n-1;
  const terminalSec=tSec[terminalIndex];
  const startSec=terminalSec-windowSec;
  const rows=[];
  for(let i=0;i<n;i++){
    if(tSec[i]+1e-9<startSec||i>terminalIndex) continue;
    const row={timestampSec:tSec[i],sampleIndex:i};
    for(const k of fields){
      if(k==='System.X') continue;
      row[k]=v[k][i];
    }
    rows.push(row);
  }
  const columns=['timestampSec','sampleIndex',...fields.filter(k=>k!=='System.X')];
  const csv=[
    columns.map(csvEscape).join(','),
    ...rows.map(r=>columns.map(c=>csvEscape(r[c])).join(','))
  ].join('\n')+'\n';
  return {terminalIndex,terminalSec,startSec,rows,columns,csv};
}

if(require.main===module){
  const inputPath=process.argv[2];
  const outputPath=process.argv[3];
  const windowSec=process.argv[4]==null?30:Number(process.argv[4]);
  if(!inputPath||!outputPath) throw new Error('usage: node scripts/build-v13-run07-checkpoints.js <native-all-variables.json> <output.csv> [windowSec]');
  if(!Number.isFinite(windowSec)||windowSec<=0) throw new Error('windowSec must be > 0');
  const result=build(JSON.parse(fs.readFileSync(inputPath,'utf8')),windowSec);
  fs.writeFileSync(outputPath,result.csv);
  process.stdout.write(JSON.stringify({
    outputPath,
    terminalIndex:result.terminalIndex,
    terminalSec:result.terminalSec,
    startSec:result.startSec,
    rowCount:result.rows.length,
    columnCount:result.columns.length
  },null,2)+'\n');
}

module.exports={DEFAULT_FIELDS,build};
