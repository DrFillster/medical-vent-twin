#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {parseSimpleCsv}=require('../src/shimayoshi_source_run.js');

const FIELDS=Object.freeze([
  'peak_Fb_mN_per_mm2',
  'end_cycle_pHi',
  'end_cycle_ExtCell_O2o_mM',
  'end_cycle_O2i_mM',
  'end_cycle_ATPTotal_mM',
  'end_cycle_PCr_mM',
  'end_cycle_Pi_mM',
  'peak_Cyt_Cai_mM',
]);

const OPTIONAL_MECHANICS_FIELDS=Object.freeze([
  'start_cycle_hsmL_um',
  'min_cycle_hsmL_um',
  'max_cycle_hsmL_um',
  'end_cycle_hsmL_um',
  'end_cycle_hsmX_um',
  'cycle_hsmL_excursion_um',
  'cycle_peak_shortening_um',
  'cycle_net_hsmL_change_um',
]);

function rel(value,reference){
  if(reference===0) return value===0?0:null;
  return Math.abs(value-reference)/Math.abs(reference);
}

function compareOverlap(referenceRows,candidateRows){
  const byTime=new Map(referenceRows.map(r=>[r.time_s,r]));
  const common=[];
  for(const c of candidateRows){
    const r=byTime.get(c.time_s);
    if(r) common.push([r,c]);
  }
  if(!common.length) throw new Error('no overlapping source-cycle times');
  const metrics={};
  const mechanicsPresent=OPTIONAL_MECHANICS_FIELDS.every(
    field=>common.every(([r,c])=>Number.isFinite(r[field])&&Number.isFinite(c[field]))
  );
  const fields=mechanicsPresent
    ? [...FIELDS,...OPTIONAL_MECHANICS_FIELDS]
    : FIELDS;
  for(const field of fields){
    const vals=common.map(([r,c])=>rel(c[field],r[field])).filter(v=>v!=null);
    metrics[field]=Object.freeze({
      maxRelativeError:Math.max(...vals),
      meanRelativeError:vals.reduce((a,b)=>a+b,0)/vals.length,
    });
  }
  const phaseMismatches=common.filter(([r,c])=>r.protocol!==c.protocol).length;
  return Object.freeze({
    commonCycles:common.length,
    startTimeS:common[0][0].time_s,
    endTimeS:common[common.length-1][0].time_s,
    phaseMismatches,
    mechanicsCompared:mechanicsPresent,
    metrics:Object.freeze(metrics),
  });
}

function main(argv=process.argv.slice(2)){
  const [referencePath,candidatePath]=argv;
  if(!referencePath||!candidatePath){
    throw new Error('usage: compare-shimayoshi-overlap.js <reference.csv> <candidate.csv>');
  }
  const read=p=>parseSimpleCsv(fs.readFileSync(path.resolve(p),'utf8'));
  process.stdout.write(JSON.stringify(
    compareOverlap(read(referencePath),read(candidatePath)),null,2
  )+'\n');
}

if(require.main===module){
  try{main();}
  catch(error){console.error(error.stack||error.message);process.exitCode=1;}
}

module.exports=Object.freeze({FIELDS,OPTIONAL_MECHANICS_FIELDS,compareOverlap});
