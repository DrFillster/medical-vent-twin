#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {
  createShimayoshiDynamicAcidosisSurrogate,
}=require('../src/shimayoshi_dynamic_acidosis_surrogate.js');

function readJson(p){
  return JSON.parse(fs.readFileSync(path.resolve(p),'utf8'));
}

function runFixedStep(sourceRun){
  const co2=sourceRun.provenance?.sourceChallengeCo2Percent;
  if(typeof co2!=='number'||!Number.isFinite(co2)){
    throw new Error('fixed-step source run missing sourceChallengeCo2Percent');
  }
  const model=createShimayoshiDynamicAcidosisSurrogate();
  let lastTime=0;
  let sumAbs=0;
  let maxAbs=null;
  let maxRel=null;
  let n=0;

  for(const row of sourceRun.trajectory){
    const dt=row.time_s-lastTime;
    if(dt<=0) throw new Error('source time must increase');
    const u=row.time_s<300||row.time_s>=900 ? 5 : co2;
    const pred=model.step({dtSec:dt,sourceEquivalentCo2Percent:u});
    lastTime=row.time_s;
    const abs=Math.abs(pred.stressRatio-row.stress_ratio);
    const rel=row.stress_ratio===0?null:abs/Math.abs(row.stress_ratio);
    const point={timeS:row.time_s,source:row.stress_ratio,predicted:pred.stressRatio,absoluteError:abs,relativeError:rel};
    sumAbs+=abs;
    n++;
    if(!maxAbs||abs>maxAbs.absoluteError) maxAbs=point;
    if(rel!=null&&(!maxRel||rel>maxRel.relativeError)) maxRel=point;
  }
  return Object.freeze({
    co2Percent:co2,
    rowCount:n,
    meanAbsoluteStressRatioError:sumAbs/n,
    maxAbsoluteStressRatioError:maxAbs,
    maxRelativeStressRatioError:maxRel,
  });
}

function dynamicScheduleCo2(timeS){
  if(timeS<300) return 5;
  if(timeS<420) return 15;
  if(timeS<540) return 25;
  if(timeS<660) return 10;
  if(timeS<780) return 30;
  if(timeS<900) return 20;
  return 5;
}

function runDynamic(dynamicRun){
  if(dynamicRun.status!=='shimayoshi-dynamic-co2-source-validation-complete'){
    throw new Error('validated dynamic source run required');
  }
  const model=createShimayoshiDynamicAcidosisSurrogate();
  let lastTime=0;
  let sumAbs=0;
  let maxAbs=null;
  let maxRel=null;
  let n=0;
  for(const row of dynamicRun.rows){
    const dt=row.time_s-lastTime;
    if(dt<=0) throw new Error('dynamic source time must increase');
    const expected=dynamicScheduleCo2(row.time_s);
    if(Math.abs(row.source_CO2_percent-expected)>1e-9){
      throw new Error('dynamic source CO2 schedule mismatch');
    }
    const pred=model.step({dtSec:dt,sourceEquivalentCo2Percent:row.source_CO2_percent});
    lastTime=row.time_s;
    const abs=Math.abs(pred.stressRatio-row.stress_ratio);
    const rel=row.stress_ratio===0?null:abs/Math.abs(row.stress_ratio);
    const point={timeS:row.time_s,co2Percent:row.source_CO2_percent,source:row.stress_ratio,predicted:pred.stressRatio,absoluteError:abs,relativeError:rel};
    sumAbs+=abs;
    n++;
    if(!maxAbs||abs>maxAbs.absoluteError) maxAbs=point;
    if(rel!=null&&(!maxRel||rel>maxRel.relativeError)) maxRel=point;
  }
  return Object.freeze({
    rowCount:n,
    meanAbsoluteStressRatioError:sumAbs/n,
    maxAbsoluteStressRatioError:maxAbs,
    maxRelativeStressRatioError:maxRel,
  });
}

function validateArtifacts({grid15,grid25,dynamic}={}){
  const fixed15=runFixedStep(grid15);
  const fixed25=runFixedStep(grid25);
  const dyn=runDynamic(dynamic);

  const limits={
    fixed15MaxRelative:0.006,
    fixed25MaxRelative:0.011,
    dynamicMaxRelative:0.009,
  };
  if(fixed15.maxRelativeStressRatioError.relativeError>=limits.fixed15MaxRelative){
    throw new Error('15% held-out validation exceeds recorded bound');
  }
  if(fixed25.maxRelativeStressRatioError.relativeError>=limits.fixed25MaxRelative){
    throw new Error('25% held-out validation exceeds recorded bound');
  }
  if(dyn.maxRelativeStressRatioError.relativeError>=limits.dynamicMaxRelative){
    throw new Error('dynamic multistep validation exceeds recorded bound');
  }

  return Object.freeze({
    status:'Shimayoshi-dynamic-acidosis-artifact-validation-passed',
    fixed15,
    fixed25,
    dynamic:dyn,
    limits:Object.freeze(limits),
    closedLoopAuthority:false,
  });
}

function main(argv=process.argv.slice(2)){
  const [grid15Path,grid25Path,dynamicPath,outputPath]=argv;
  if(!grid15Path||!grid25Path||!dynamicPath){
    throw new Error('usage: validate-shimayoshi-dynamic-surrogate-artifacts.js <15.json> <25.json> <dynamic.json> [output.json]');
  }
  const result=validateArtifacts({
    grid15:readJson(grid15Path),
    grid25:readJson(grid25Path),
    dynamic:readJson(dynamicPath),
  });
  const out=JSON.stringify(result,null,2)+'\n';
  if(outputPath) fs.writeFileSync(path.resolve(outputPath),out);
  else process.stdout.write(out);
}

if(require.main===module){
  try{main();}
  catch(error){console.error(error.stack||error.message);process.exitCode=1;}
}

module.exports=Object.freeze({
  runFixedStep,
  runDynamic,
  validateArtifacts,
});
