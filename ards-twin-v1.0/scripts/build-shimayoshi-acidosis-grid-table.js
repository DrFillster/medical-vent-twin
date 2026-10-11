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

  const levels=sorted.map(run=>{
    if(run.status!=='shimayoshi-source-stress-trajectory-validated'||
       run.provenance?.protocolName!=='acidosis'){
      throw new Error('validated acidosis source run is required');
    }
    const co2=challenge(run);
    if(typeof co2!=='number'||!Number.isFinite(co2)||!(co2>0)){
      throw new Error('sourceChallengeCo2Percent must be finite and > 0');
    }
    return Object.freeze({
      sourceChallengeCo2Percent:co2,
      cvodeTargetCadenceMs:run.provenance.cvodeTargetCadenceMs,
      rows:Object.freeze(run.trajectory.map(r=>Object.freeze({
        time_s:r.time_s,
        protocol:r.protocol,
        peak_Fb_mN_per_mm2:r.peak_Fb_mN_per_mm2,
        stress_ratio:r.stress_ratio,
      }))),
    });
  });

  return Object.freeze({
    schema:'shimayoshi-acidosis-grid-table/v1',
    upstreamGitSha:upstream,
    referencePeakFbMnPerMm2:ref,
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
  fs.writeFileSync(path.resolve(output),JSON.stringify(table,null,2)+'\n');
  process.stdout.write(JSON.stringify({
    status:'shimayoshi-acidosis-grid-table-built',
    output,
    levels:table.levels.map(x=>x.sourceChallengeCo2Percent),
    rowsPerLevel:table.levels.map(x=>x.rows.length),
    upstreamGitSha:table.upstreamGitSha,
    closedLoopAuthority:false,
  },null,2)+'\n');
}

if(require.main===module){
  try{main();}
  catch(error){console.error(error.stack||error.message);process.exitCode=1;}
}

module.exports=Object.freeze({buildTable});
