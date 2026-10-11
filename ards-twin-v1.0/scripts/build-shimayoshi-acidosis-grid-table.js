#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');

const DEFAULT_COMPRESSION_TOLERANCE=0.0002;

function read(p){
  return JSON.parse(fs.readFileSync(path.resolve(p),'utf8'));
}

function challenge(run){
  return run?.provenance?.sourceChallengeCo2Percent;
}

function adaptiveKeyframeIndices(rows,tolerance=DEFAULT_COMPRESSION_TOLERANCE){
  if(!Array.isArray(rows)||rows.length<2){
    throw new Error('source trajectory must contain at least two cycles');
  }
  if(typeof tolerance!=='number'||!Number.isFinite(tolerance)||!(tolerance>0)){
    throw new Error('compression tolerance must be finite and > 0');
  }
  const keep=new Set([0,rows.length-1]);
  for(let i=1;i<rows.length;i++){
    if(rows[i].protocol!==rows[i-1].protocol){
      keep.add(i-1);
      keep.add(i);
    }
  }
  const mandatory=[...keep].sort((a,b)=>a-b);
  const stack=[];
  for(let i=1;i<mandatory.length;i++){
    if(mandatory[i]-mandatory[i-1]>1){
      stack.push([mandatory[i-1],mandatory[i]]);
    }
  }

  while(stack.length){
    const [a,b]=stack.pop();
    const xa=rows[a].time_s;
    const xb=rows[b].time_s;
    const ya=rows[a].stress_ratio;
    const yb=rows[b].stress_ratio;
    let maxError=-1;
    let maxIndex=null;

    for(let i=a+1;i<b;i++){
      const fraction=(rows[i].time_s-xa)/(xb-xa);
      const predicted=ya+(yb-ya)*fraction;
      const error=Math.abs(rows[i].stress_ratio-predicted);
      if(error>maxError){
        maxError=error;
        maxIndex=i;
      }
    }

    if(maxError>tolerance&&maxIndex!=null){
      keep.add(maxIndex);
      stack.push([a,maxIndex],[maxIndex,b]);
    }
  }

  return Object.freeze([...keep].sort((a,b)=>a-b));
}

function compressionError(rows,indices){
  let maxAbsoluteStressRatioError=0;
  let sumSquared=0;
  let segment=0;

  for(let i=0;i<rows.length;i++){
    while(segment+1<indices.length&&i>indices[segment+1]) segment+=1;
    let predicted;
    if(i===indices[segment]){
      predicted=rows[i].stress_ratio;
    }else{
      const a=indices[segment];
      const b=indices[segment+1];
      const fraction=(rows[i].time_s-rows[a].time_s)/
        (rows[b].time_s-rows[a].time_s);
      predicted=rows[a].stress_ratio+
        (rows[b].stress_ratio-rows[a].stress_ratio)*fraction;
    }
    const error=Math.abs(predicted-rows[i].stress_ratio);
    if(error>maxAbsoluteStressRatioError) maxAbsoluteStressRatioError=error;
    sumSquared+=error*error;
  }

  return Object.freeze({
    maxAbsoluteStressRatioError,
    rootMeanSquareStressRatioError:Math.sqrt(sumSquared/rows.length),
  });
}

function buildTable(runs,{
  compressionTolerance=DEFAULT_COMPRESSION_TOLERANCE,
  sourceGridWorkflowRunId=null,
  sourceGridArtifactId=null,
  sourceGridArtifactDigest=null,
  challengeInterpolationValidation=null,
}={}){
  if(!Array.isArray(runs)||runs.length<2){
    throw new Error('at least two validated source runs are required');
  }

  const sorted=[...runs].sort((a,b)=>challenge(a)-challenge(b));
  const refs=sorted.map(r=>r.referencePeakStressMnPerMm2);
  if(refs.some(x=>typeof x!=='number'||!Number.isFinite(x)||!(x>0))){
    throw new Error('every run must have a positive source reference peak Fb');
  }
  const referencePeakFbMnPerMm2=refs[0];
  if(refs.some(x=>Math.abs(x-referencePeakFbMnPerMm2)>1e-12)){
    throw new Error('source runs must share the same control reference peak Fb');
  }

  const upstreamGitSha=sorted[0]?.provenance?.upstreamGitSha;
  if(!upstreamGitSha||
     sorted.some(r=>r.provenance?.upstreamGitSha!==upstreamGitSha)){
    throw new Error('source runs must share one pinned upstream SHA');
  }

  const levels=sorted.map(run=>{
    if(run.status!=='shimayoshi-source-stress-trajectory-validated'||
       run.provenance?.protocolName!=='acidosis'){
      throw new Error('validated acidosis source run is required');
    }
    const sourceChallengeCo2Percent=challenge(run);
    if(typeof sourceChallengeCo2Percent!=='number'||
       !Number.isFinite(sourceChallengeCo2Percent)||
       !(sourceChallengeCo2Percent>0)){
      throw new Error('sourceChallengeCo2Percent must be finite and > 0');
    }

    const indices=adaptiveKeyframeIndices(run.trajectory,compressionTolerance);
    const error=compressionError(run.trajectory,indices);
    if(error.maxAbsoluteStressRatioError>compressionTolerance+1e-12){
      throw new Error('source time compression exceeded declared error bound');
    }

    return Object.freeze({
      sourceChallengeCo2Percent,
      cvodeTargetCadenceMs:run.provenance.cvodeTargetCadenceMs,
      sourceCycleCount:run.trajectory.length,
      keyframes:Object.freeze(indices.map(i=>Object.freeze([
        run.trajectory[i].time_s,
        run.trajectory[i].stress_ratio,
      ]))),
      compressionError:error,
    });
  });

  return Object.freeze({
    schema:'shimayoshi-acidosis-grid-table/v3',
    upstreamGitSha,
    sourceGridWorkflowRunId,
    sourceGridArtifactId,
    sourceGridArtifactDigest,
    referencePeakFbMnPerMm2,
    protocolTimingS:Object.freeze({
      acidosisOn:300,
      recoveryOn:900,
    }),
    sourceCyclePeriodS:0.4,
    timeCompression:Object.freeze({
      method:'piecewise-linear adaptive keyframes',
      maxAbsoluteStressRatioErrorPerSourceLevel:compressionTolerance,
      validationBasis:'all source paced cycles at each CO2 level',
    }),
    challengeInterpolationValidation:challengeInterpolationValidation
      ? Object.freeze(challengeInterpolationValidation)
      : null,
    controlAuthority:false,
    closedLoopAuthority:false,
    interpolation:
      'piecewise-linear in source challenge CO2 percent and source time; no extrapolation',
    levels:Object.freeze(levels),
  });
}

function main(argv=process.argv.slice(2)){
  if(argv.length<3){
    throw new Error(
      'usage: build-shimayoshi-acidosis-grid-table.js <import.json> <import.json> [...] <output.json>'
    );
  }
  const output=argv[argv.length-1];
  const inputs=argv.slice(0,-1);
  const table=buildTable(inputs.map(read));
  fs.writeFileSync(path.resolve(output),JSON.stringify(table)+'\n');
  process.stdout.write(JSON.stringify({
    status:'shimayoshi-acidosis-grid-table-built',
    output,
    levels:table.levels.map(x=>x.sourceChallengeCo2Percent),
    keyframesPerLevel:table.levels.map(x=>x.keyframes.length),
    totalKeyframes:table.levels.reduce((n,x)=>n+x.keyframes.length,0),
    upstreamGitSha:table.upstreamGitSha,
    closedLoopAuthority:false,
  },null,2)+'\n');
}

if(require.main===module){
  try{main();}
  catch(error){console.error(error.stack||error.message);process.exitCode=1;}
}

module.exports=Object.freeze({
  DEFAULT_COMPRESSION_TOLERANCE,
  adaptiveKeyframeIndices,
  compressionError,
  buildTable,
});
