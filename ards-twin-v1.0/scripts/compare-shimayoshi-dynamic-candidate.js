#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {
  initialState,
  advanceDynamicCandidate,
}=require('../src/shimayoshi_acidosis_dynamic_candidate.js');

function compareDynamicSource(validated){
  if(!validated||
     validated.status!=='shimayoshi-dynamic-co2-source-validation-complete'){
    throw new Error('validated dynamic Shimayoshi source trajectory is required');
  }
  const rows=validated.rows;
  if(!Array.isArray(rows)||!rows.length){
    throw new Error('validated dynamic source rows are required');
  }

  let state=initialState();
  let priorTime=0;
  let sumSq=0;
  let sumAbs=0;
  let maxAbs=0;
  let maxRel=0;
  let maxRow=null;
  const predictions=[];

  for(const row of rows){
    const dt=row.time_s-priorTime;
    if(!(dt>0)) throw new Error('source time must increase');
    state=advanceDynamicCandidate({
      state,
      sourceCo2Percent:row.source_CO2_percent,
      dtSec:dt,
    });
    const err=state.stressRatio-row.stress_ratio;
    const abs=Math.abs(err);
    const rel=abs/Math.max(Math.abs(row.stress_ratio),1e-12);
    sumSq+=err*err;
    sumAbs+=abs;
    if(abs>maxAbs){
      maxAbs=abs;
      maxRow=row;
    }
    if(rel>maxRel) maxRel=rel;
    predictions.push(Object.freeze({
      time_s:row.time_s,
      source_CO2_percent:row.source_CO2_percent,
      sourceStressRatio:row.stress_ratio,
      predictedStressRatio:state.stressRatio,
      error:err,
    }));
    priorTime=row.time_s;
  }

  return Object.freeze({
    status:'shimayoshi-dynamic-candidate-blind-comparison',
    sourceRows:rows.length,
    rmseStressRatio:Math.sqrt(sumSq/rows.length),
    meanAbsoluteStressRatioError:sumAbs/rows.length,
    maxAbsoluteStressRatioError:maxAbs,
    maxRelativeStressRatioError:maxRel,
    maxAbsoluteErrorAt:maxRow?Object.freeze({
      time_s:maxRow.time_s,
      source_CO2_percent:maxRow.source_CO2_percent,
      sourceStressRatio:maxRow.stress_ratio,
    }):null,
    predictions:Object.freeze(predictions),
    fittedToBlindTrajectory:false,
    closedLoopAuthority:false,
  });
}

function main(argv=process.argv.slice(2)){
  const [inputPath,outputPath]=argv;
  if(!inputPath){
    throw new Error(
      'usage: compare-shimayoshi-dynamic-candidate.js <validated.json> [output.json]'
    );
  }
  const validated=JSON.parse(fs.readFileSync(path.resolve(inputPath),'utf8'));
  const result=compareDynamicSource(validated);
  const out=JSON.stringify(result,null,2)+'\n';
  if(outputPath) fs.writeFileSync(path.resolve(outputPath),out);
  else process.stdout.write(out);
}

if(require.main===module){
  try{main();}
  catch(error){console.error(error.stack||error.message);process.exitCode=1;}
}

module.exports=Object.freeze({compareDynamicSource});
