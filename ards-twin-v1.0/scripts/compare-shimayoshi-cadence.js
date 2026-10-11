#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {parseSimpleCsv}=require('../src/shimayoshi_source_run.js');

function finiteRelativeError(value,reference){
  if(!Number.isFinite(value)||!Number.isFinite(reference)){
    throw new Error('cadence comparison values must be finite');
  }
  if(reference===0) return value===0?0:null;
  return Math.abs(value-reference)/Math.abs(reference);
}

function summarize(rows){
  if(!rows.length) throw new Error('source rows are required');
  const last=rows[rows.length-1];
  return Object.freeze({
    cycles:rows.length,
    meanPeakFb:rows.reduce((s,r)=>s+r.peak_Fb_mN_per_mm2,0)/rows.length,
    last_pHi:last.end_cycle_pHi,
    last_ExtCell_O2o_mM:last.end_cycle_ExtCell_O2o_mM,
    last_O2i_mM:last.end_cycle_O2i_mM,
    last_ATPTotal_mM:last.end_cycle_ATPTotal_mM,
    last_PCr_mM:last.end_cycle_PCr_mM,
    last_Pi_mM:last.end_cycle_Pi_mM,
    meanPeakCai:rows.reduce((s,r)=>s+r.peak_Cyt_Cai_mM,0)/rows.length,
  });
}

function compare(referenceRows,candidateRows){
  const ref=summarize(referenceRows);
  const cand=summarize(candidateRows);
  const keys=[
    'meanPeakFb','last_pHi','last_ExtCell_O2o_mM','last_O2i_mM',
    'last_ATPTotal_mM','last_PCr_mM','last_Pi_mM','meanPeakCai'
  ];
  const relativeError={};
  for(const key of keys) relativeError[key]=finiteRelativeError(cand[key],ref[key]);
  return Object.freeze({reference:ref,candidate:cand,relativeError});
}

function main(argv=process.argv.slice(2)){
  const [referencePath,...candidatePaths]=argv;
  if(!referencePath||!candidatePaths.length){
    throw new Error('usage: compare-shimayoshi-cadence.js <reference.csv> <candidate.csv> [...]');
  }
  const read=p=>parseSimpleCsv(fs.readFileSync(path.resolve(p),'utf8'));
  const ref=read(referencePath);
  const results=candidatePaths.map(p=>({
    file:p,
    ...compare(ref,read(p)),
  }));
  process.stdout.write(JSON.stringify(results,null,2)+'\n');
}

if(require.main===module){
  try{main();}
  catch(error){console.error(error.stack||error.message);process.exitCode=1;}
}

module.exports=Object.freeze({summarize,compare,finiteRelativeError});
