#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');

function finiteRows(run){
  if(!run||run.status!=='shimayoshi-source-stress-trajectory-validated'){
    throw new Error('validated Shimayoshi source import is required');
  }
  if(!Array.isArray(run.trajectory)||!run.trajectory.length){
    throw new Error('validated source trajectory is required');
  }
  return run.trajectory;
}

function summarizePhase(rows,phase){
  const r=rows.filter(x=>x.protocol===phase);
  if(!r.length) return null;
  let minFb=r[0],maxFb=r[0],minPH=r[0],maxPH=r[0];
  let sumFb=0,sumRatio=0;
  for(const x of r){
    if(x.peak_Fb_mN_per_mm2<minFb.peak_Fb_mN_per_mm2) minFb=x;
    if(x.peak_Fb_mN_per_mm2>maxFb.peak_Fb_mN_per_mm2) maxFb=x;
    if(x.end_cycle_pHi<minPH.end_cycle_pHi) minPH=x;
    if(x.end_cycle_pHi>maxPH.end_cycle_pHi) maxPH=x;
    sumFb+=x.peak_Fb_mN_per_mm2;
    sumRatio+=x.stress_ratio;
  }
  return Object.freeze({
    phase,
    cycles:r.length,
    startTimeS:r[0].time_s,
    endTimeS:r[r.length-1].time_s,
    meanPeakFbMnPerMm2:sumFb/r.length,
    meanStressRatio:sumRatio/r.length,
    minPeakFb:Object.freeze({
      time_s:minFb.time_s,
      peak_Fb_mN_per_mm2:minFb.peak_Fb_mN_per_mm2,
      stress_ratio:minFb.stress_ratio,
      pHi:minFb.end_cycle_pHi,
      peak_Cyt_Cai_mM:minFb.peak_Cyt_Cai_mM,
      ATPTotal_mM:minFb.end_cycle_ATPTotal_mM,
      PCr_mM:minFb.end_cycle_PCr_mM,
      Pi_mM:minFb.end_cycle_Pi_mM,
    }),
    maxPeakFb:Object.freeze({
      time_s:maxFb.time_s,
      peak_Fb_mN_per_mm2:maxFb.peak_Fb_mN_per_mm2,
      stress_ratio:maxFb.stress_ratio,
    }),
    minPHi:Object.freeze({
      time_s:minPH.time_s,
      pHi:minPH.end_cycle_pHi,
      peak_Fb_mN_per_mm2:minPH.peak_Fb_mN_per_mm2,
      stress_ratio:minPH.stress_ratio,
    }),
    maxPHi:Object.freeze({
      time_s:maxPH.time_s,
      pHi:maxPH.end_cycle_pHi,
    }),
  });
}

function nearest(rows,timeS){
  let best=rows[0];
  let d=Math.abs(best.time_s-timeS);
  for(const r of rows.slice(1)){
    const nd=Math.abs(r.time_s-timeS);
    if(nd<d){best=r;d=nd;}
  }
  return best;
}

function summarizeRun(run){
  const rows=finiteRows(run);
  const phases=[...new Set(rows.map(x=>x.protocol))];
  const phaseSummaries={};
  for(const p of phases) phaseSummaries[p]=summarizePhase(rows,p);
  const checkpoints={};
  for(const t of [299.6,300,300.4,899.6,900,900.4,930,960]){
    const x=nearest(rows,t);
    checkpoints[String(t)]=Object.freeze({
      time_s:x.time_s,
      protocol:x.protocol,
      peak_Fb_mN_per_mm2:x.peak_Fb_mN_per_mm2,
      stress_ratio:x.stress_ratio,
      pHi:x.end_cycle_pHi,
      peak_Cyt_Cai_mM:x.peak_Cyt_Cai_mM,
      ATPTotal_mM:x.end_cycle_ATPTotal_mM,
      PCr_mM:x.end_cycle_PCr_mM,
      Pi_mM:x.end_cycle_Pi_mM,
    });
  }
  return Object.freeze({
    status:'shimayoshi-source-run-summary',
    referencePeakStressMnPerMm2:run.referencePeakStressMnPerMm2,
    phases:Object.freeze(phases),
    phaseSummaries:Object.freeze(phaseSummaries),
    checkpoints:Object.freeze(checkpoints),
    provenance:run.provenance,
  });
}

function main(argv=process.argv.slice(2)){
  const [inputPath,outputPath]=argv;
  if(!inputPath) throw new Error('usage: summarize-shimayoshi-source-run.js <import.json> [output.json]');
  const run=JSON.parse(fs.readFileSync(path.resolve(inputPath),'utf8'));
  const out=JSON.stringify(summarizeRun(run),null,2)+'\n';
  if(outputPath) fs.writeFileSync(path.resolve(outputPath),out);
  else process.stdout.write(out);
}

if(require.main===module){
  try{main();}
  catch(error){console.error(error.stack||error.message);process.exitCode=1;}
}

module.exports=Object.freeze({summarizePhase,summarizeRun,nearest});
