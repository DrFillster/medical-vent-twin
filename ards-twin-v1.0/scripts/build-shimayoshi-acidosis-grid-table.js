#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');

function read(p){
  return JSON.parse(fs.readFileSync(path.resolve(p),'utf8'));
}

function challenge(run){
  return run?.provenance?.sourceChallengeCo2Percent;
}

function uniformTimeGrid(rows){
  if(!Array.isArray(rows)||rows.length<2){
    throw new Error('source trajectory must contain at least two cycles');
  }
  const start=rows[0].time_s;
  const step=rows[1].time_s-rows[0].time_s;
  if(!(step>0)||!Number.isFinite(step)) throw new Error('source time step must be positive');
  for(let i=1;i<rows.length;i++){
    const expected=start+i*step;
    if(Math.abs(rows[i].time_s-expected)>1e-8){
      throw new Error('source trajectory must use one uniform paced-cycle time grid');
    }
  }
  return Object.freeze({startTimeS:start,timeStepS:step,endTimeS:rows[rows.length-1].time_s,count:rows.length});
}

function buildTable(runs){
  if(!Array.isArray(runs)||runs.length<2){
    throw new Error('at least two validated source runs are required');
  }
  const sorted=[...runs].sort((a,b)=>challenge(a)-challenge(b));
  const refs=sorted.map(r=>r.referencePeakStressMnPerMm2);
  if(refs.some(x=>typeof x!=='number'||!Number.isFinite(x)||!(x>0))){
    throw new Error('every run must have a positive source reference peak Fb');
  }
  const ref=refs[0];
  if(refs.some(x=>Math.abs(x-ref)>1e-12)){
    throw new Error('source runs must share the same control reference peak Fb');
  }

  const upstream=sorted[0]?.provenance?.upstreamGitSha;
  if(!upstream||sorted.some(r=>r.provenance?.upstreamGitSha!==upstream)){
    throw new Error('source runs must share one pinned upstream SHA');
  }

  const baseGrid=uniformTimeGrid(sorted[0].trajectory);
  const levels=sorted.map(run=>{
    if(run.status!=='shimayoshi-source-stress-trajectory-validated'||
       run.provenance?.protocolName!=='acidosis'){
      throw new Error('validated acidosis source run is required');
    }
    const co2=challenge(run);
    if(typeof co2!=='number'||!Number.isFinite(co2)||!(co2>0)){
      throw new Error('sourceChallengeCo2Percent must be finite and > 0');
    }
    const grid=uniformTimeGrid(run.trajectory);
    for(const key of ['startTimeS','timeStepS','endTimeS','count']){
      if(Math.abs(grid[key]-baseGrid[key])>1e-8){
        throw new Error('all source challenge runs must share one time grid');
      }
    }
    return Object.freeze({
      sourceChallengeCo2Percent:co2,
      cvodeTargetCadenceMs:run.provenance.cvodeTargetCadenceMs,
      stressRatios:Object.freeze(run.trajectory.map(r=>r.stress_ratio)),
    });
  });

  return Object.freeze({
    schema:'shimayoshi-acidosis-grid-table/v2',
    upstreamGitSha:upstream,
    referencePeakFbMnPerMm2:ref,
    timeGrid:baseGrid,
    protocolTimingS:Object.freeze({
      acidosisOn:300,
      recoveryOn:900,
    }),
    controlAuthority:false,
    closedLoopAuthority:false,
    interpolation:'piecewise-linear in source challenge CO2 percent and source time; no extrapolation',
    levels:Object.freeze(levels),
  });
}

function main(argv=process.argv.slice(2)){
  if(argv.length<3){
    throw new Error('usage: build-shimayoshi-acidosis-grid-table.js <import.json> <import.json> [...] <output.json>');
  }
  const output=argv[argv.length-1];
  const inputs=argv.slice(0,-1);
  const table=buildTable(inputs.map(read));
  fs.writeFileSync(path.resolve(output),JSON.stringify(table)+'\n');
  process.stdout.write(JSON.stringify({
    status:'shimayoshi-acidosis-grid-table-built',
    output,
    levels:table.levels.map(x=>x.sourceChallengeCo2Percent),
    cyclesPerLevel:table.timeGrid.count,
    upstreamGitSha:table.upstreamGitSha,
    closedLoopAuthority:false,
  },null,2)+'\n');
}

if(require.main===module){
  try{main();}
  catch(error){console.error(error.stack||error.message);process.exitCode=1;}
}

module.exports=Object.freeze({uniformTimeGrid,buildTable});
