#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {
  createAcidosisGridSurrogate,
}=require('../src/shimayoshi_acidosis_grid_surrogate.js');

function readRun(p){
  return JSON.parse(fs.readFileSync(path.resolve(p),'utf8'));
}

function challenge(run){
  return run?.provenance?.sourceChallengeCo2Percent;
}

function validateHeldOut(allRuns,heldOutCo2){
  const held=allRuns.find(r=>challenge(r)===heldOutCo2);
  if(!held) throw new Error('held-out challenge not found: '+heldOutCo2);

  const train=allRuns.filter(r=>challenge(r)!==heldOutCo2);
  const levels=train.map(challenge).sort((a,b)=>a-b);
  if(!(levels.some(x=>x<heldOutCo2)&&levels.some(x=>x>heldOutCo2))){
    throw new Error('held-out challenge must remain bracketed by training source levels');
  }

  const surrogate=createAcidosisGridSurrogate(train);
  let sumAbs=0,sumSq=0,maxAbs=0,maxRel=0,maxRatioAbs=0;
  let worst=null;
  for(const row of held.trajectory){
    const pred=surrogate.evaluate({
      sourceChallengeCo2Percent:heldOutCo2,
      sourceTimeS:row.time_s,
    });
    const err=pred.peakFbMnPerMm2-row.peak_Fb_mN_per_mm2;
    const abs=Math.abs(err);
    const rel=row.peak_Fb_mN_per_mm2===0?null:abs/Math.abs(row.peak_Fb_mN_per_mm2);
    const ratioAbs=Math.abs(pred.stressRatio-row.stress_ratio);
    sumAbs+=abs;
    sumSq+=err*err;
    if(abs>maxAbs){
      maxAbs=abs;
      worst={
        time_s:row.time_s,
        protocol:row.protocol,
        observedFb:row.peak_Fb_mN_per_mm2,
        predictedFb:pred.peakFbMnPerMm2,
        absoluteError:abs,
        relativeError:rel,
      };
    }
    if(rel!=null&&rel>maxRel) maxRel=rel;
    if(ratioAbs>maxRatioAbs) maxRatioAbs=ratioAbs;
  }
  const n=held.trajectory.length;
  return Object.freeze({
    heldOutCo2Percent:heldOutCo2,
    trainingLevels:Object.freeze([...levels]),
    cycles:n,
    meanAbsoluteErrorFbMnPerMm2:sumAbs/n,
    rootMeanSquareErrorFbMnPerMm2:Math.sqrt(sumSq/n),
    maxAbsoluteErrorFbMnPerMm2:maxAbs,
    maxRelativeErrorFb:maxRel,
    maxAbsoluteStressRatioError:maxRatioAbs,
    worstCycle:Object.freeze(worst),
  });
}

function main(argv=process.argv.slice(2)){
  if(argv.length<3){
    throw new Error('usage: validate-shimayoshi-acidosis-grid-surrogate.js <import.json> <import.json> <import.json> [...]');
  }
  const runs=argv.map(readRun).sort((a,b)=>challenge(a)-challenge(b));
  const levels=runs.map(challenge);
  const interior=levels.slice(1,-1);
  const validations=interior.map(c=>validateHeldOut(runs,c));
  process.stdout.write(JSON.stringify({
    status:'shimayoshi-acidosis-grid-surrogate-withheld-validation',
    sourceLevels:levels,
    heldOutValidations:validations,
    closedLoopAuthority:false,
  },null,2)+'\n');
}

if(require.main===module){
  try{main();}
  catch(error){console.error(error.stack||error.message);process.exitCode=1;}
}

module.exports=Object.freeze({validateHeldOut});
