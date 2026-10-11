#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite');
  return v;
}

function median(xs){
  const a=[...xs].sort((x,y)=>x-y);
  if(!a.length) return null;
  const m=Math.floor(a.length/2);
  return a.length%2?a[m]:(a[m-1]+a[m])/2;
}

function summarize(rows,phase){
  if(!rows.length) return null;
  const metrics=[
    'stress_ratio',
    'shortening_ratio',
    'cycle_peak_shortening_um',
    'start_cycle_hsmL_um',
    'end_cycle_hsmL_um',
    'cycle_net_hsmL_change_um',
    'end_cycle_pHi',
    'end_cycle_ExtCell_O2o_mM',
    'end_cycle_O2i_mM',
    'end_cycle_ATPTotal_mM',
    'end_cycle_PCr_mM',
    'end_cycle_Pi_mM',
    'peak_Cyt_Cai_mM',
  ];
  const out={phase,rowCount:rows.length,startTimeS:rows[0].time_s,endTimeS:rows.at(-1).time_s};
  for(const key of metrics){
    const vals=rows.map(r=>r[key]).filter(Number.isFinite);
    if(!vals.length) continue;
    const min=Math.min(...vals), max=Math.max(...vals);
    out[key]={min,max,median:median(vals),first:vals[0],last:vals.at(-1)};
  }
  return Object.freeze(out);
}

function analyze(imported){
  if(!imported||imported.status!=='shimayoshi-source-stress-trajectory-validated'){
    throw new Error('validated Shimayoshi source trajectory required');
  }
  const rows=imported.trajectory;
  if(!rows.length) throw new Error('trajectory is empty');
  if(!rows.every(r=>Number.isFinite(r.cycle_peak_shortening_um))){
    throw new Error('mechanics columns are required');
  }

  const phases=[...new Set(rows.map(r=>r.protocol))];
  const phaseSummaries=phases.map(p=>summarize(rows.filter(r=>r.protocol===p),p));

  const minimumShortening=rows.reduce((a,b)=>
    b.cycle_peak_shortening_um<a.cycle_peak_shortening_um?b:a
  );
  const maximumStress=rows.reduce((a,b)=>
    b.stress_ratio>a.stress_ratio?b:a
  );
  const minimumAtp=rows.reduce((a,b)=>
    b.end_cycle_ATPTotal_mM<a.end_cycle_ATPTotal_mM?b:a
  );
  const minimumPcr=rows.reduce((a,b)=>
    b.end_cycle_PCr_mM<a.end_cycle_PCr_mM?b:a
  );
  const minimumPhi=rows.reduce((a,b)=>
    b.end_cycle_pHi<a.end_cycle_pHi?b:a
  );

  return Object.freeze({
    status:'Shimayoshi-ischemia-mechanics-descriptive-analysis-complete',
    interpretation:
      'Descriptive source mechanics only. No contracture threshold or clinical authority is assigned.',
    referencePeakStressMnPerMm2:imported.referencePeakStressMnPerMm2,
    referencePeakShorteningUm:imported.referencePeakShorteningUm,
    phases:Object.freeze(phaseSummaries),
    extrema:Object.freeze({
      minimumShortening,
      maximumStress,
      minimumAtp,
      minimumPcr,
      minimumPhi,
    }),
    controlAuthority:false,
  });
}

function main(argv=process.argv.slice(2)){
  const [inputPath,outputPath]=argv;
  if(!inputPath) throw new Error('usage: analyze-shimayoshi-ischemia-mechanics.js <import.json> [output.json]');
  const imported=JSON.parse(fs.readFileSync(path.resolve(inputPath),'utf8'));
  const result=analyze(imported);
  const out=JSON.stringify(result,null,2)+'\n';
  if(outputPath) fs.writeFileSync(path.resolve(outputPath),out);
  else process.stdout.write(out);
}

if(require.main===module){
  try{main();}
  catch(error){console.error(error.stack||error.message);process.exitCode=1;}
}

module.exports=Object.freeze({analyze,summarize});
