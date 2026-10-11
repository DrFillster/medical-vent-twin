#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {
  SHIMAYOSHI_ACIDOSIS_GRID_TABLE_V3,
}=require('../src/shimayoshi_acidosis_grid_data.js');
const {
  createAcidosisGridSurrogateFromTable,
}=require('../src/shimayoshi_acidosis_grid_surrogate.js');

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite');
  return v;
}

function compareDynamicSource(dynamicValidation,table=SHIMAYOSHI_ACIDOSIS_GRID_TABLE_V3){
  if(!dynamicValidation||
     dynamicValidation.status!=='shimayoshi-dynamic-co2-source-validation-complete'||
     !Array.isArray(dynamicValidation.rows)||
     !dynamicValidation.rows.length){
    throw new Error('validated dynamic Shimayoshi source trajectory is required');
  }

  const surrogate=createAcidosisGridSurrogateFromTable(table);
  const rows=[];
  for(const src of dynamicValidation.rows){
    finite(src.time_s,'time_s');
    finite(src.source_CO2_percent,'source_CO2_percent');
    finite(src.stress_ratio,'stress_ratio');

    let prediction=null;
    let error=null;
    try{
      prediction=surrogate.evaluate({
        sourceChallengeCo2Percent:src.source_CO2_percent,
        sourceTimeS:src.time_s,
      });
      error=prediction.stressRatio-src.stress_ratio;
    }catch(e){
      error=null;
    }

    rows.push(Object.freeze({
      timeS:src.time_s,
      sourcePhase:src.protocol,
      sourceCo2Percent:src.source_CO2_percent,
      sourceStressRatio:src.stress_ratio,
      predictedStressRatio:prediction?prediction.stressRatio:null,
      signedError:error,
      absoluteError:error==null?null:Math.abs(error),
      relativeError:error==null||src.stress_ratio===0
        ? null
        : Math.abs(error)/Math.abs(src.stress_ratio),
    }));
  }

  const comparable=rows.filter(r=>r.absoluteError!=null);
  if(!comparable.length) throw new Error('no dynamic source rows overlap compressed-grid domain');

  const maxAbs=comparable.reduce((a,b)=>b.absoluteError>a.absoluteError?b:a);
  const maxRel=comparable
    .filter(r=>r.relativeError!=null)
    .reduce((a,b)=>b.relativeError>a.relativeError?b:a);

  const segments=(dynamicValidation.segments||[]).map(seg=>{
    const rr=comparable.filter(r=>
      r.timeS>=seg.startS && (seg.endS==null||r.timeS<seg.endS)
    );
    if(!rr.length) return null;
    const max=rr.reduce((a,b)=>b.absoluteError>a.absoluteError?b:a);
    return Object.freeze({
      startS:seg.startS,
      endS:seg.endS,
      co2Percent:seg.co2Percent,
      phase:seg.phase,
      rowCount:rr.length,
      meanAbsoluteStressRatioError:
        rr.reduce((s,r)=>s+r.absoluteError,0)/rr.length,
      maxAbsoluteStressRatioError:max.absoluteError,
      maxErrorTimeS:max.timeS,
      maxErrorSourceStressRatio:max.sourceStressRatio,
      maxErrorPredictedStressRatio:max.predictedStressRatio,
    });
  }).filter(Boolean);

  return Object.freeze({
    status:'dynamic-source-vs-fixed-step-grid-comparison-complete',
    interpretation:
      'This evaluates fixed-step grid portability to a multistep CO2 history; it is not a clinical validation.',
    rowCount:rows.length,
    comparableRowCount:comparable.length,
    maxAbsoluteStressRatioError:Object.freeze({...maxAbs}),
    maxRelativeStressRatioError:Object.freeze({...maxRel}),
    meanAbsoluteStressRatioError:
      comparable.reduce((s,r)=>s+r.absoluteError,0)/comparable.length,
    segments:Object.freeze(segments),
    closedLoopAuthority:false,
  });
}

function main(argv=process.argv.slice(2)){
  const [dynamicPath,outputPath]=argv;
  if(!dynamicPath){
    throw new Error('usage: compare-shimayoshi-dynamic-grid.js <validated-dynamic.json> [output.json]');
  }
  const dynamic=JSON.parse(fs.readFileSync(path.resolve(dynamicPath),'utf8'));
  const result=compareDynamicSource(dynamic);
  const out=JSON.stringify(result,null,2)+'\n';
  if(outputPath) fs.writeFileSync(path.resolve(outputPath),out);
  else process.stdout.write(out);
}

if(require.main===module){
  try{main();}
  catch(error){console.error(error.stack||error.message);process.exitCode=1;}
}

module.exports=Object.freeze({compareDynamicSource});
