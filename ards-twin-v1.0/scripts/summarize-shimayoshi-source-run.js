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
  let minExcursion=null,maxExcursion=null,minEndHsmL=null,maxEndHsmL=null;
  let sumFb=0,sumRatio=0,sumExcursion=0,mechanicsCount=0;
  for(const x of r){
    if(x.peak_Fb_mN_per_mm2<minFb.peak_Fb_mN_per_mm2) minFb=x;
    if(x.peak_Fb_mN_per_mm2>maxFb.peak_Fb_mN_per_mm2) maxFb=x;
    if(x.end_cycle_pHi<minPH.end_cycle_pHi) minPH=x;
    if(x.end_cycle_pHi>maxPH.end_cycle_pHi) maxPH=x;
    sumFb+=x.peak_Fb_mN_per_mm2;
    sumRatio+=x.stress_ratio;
    if(Number.isFinite(x.cycle_hsmL_excursion_um)){
      mechanicsCount+=1;
      sumExcursion+=x.cycle_hsmL_excursion_um;
      if(!minExcursion||x.cycle_hsmL_excursion_um<minExcursion.cycle_hsmL_excursion_um) minExcursion=x;
      if(!maxExcursion||x.cycle_hsmL_excursion_um>maxExcursion.cycle_hsmL_excursion_um) maxExcursion=x;
      if(!minEndHsmL||x.end_cycle_hsmL_um<minEndHsmL.end_cycle_hsmL_um) minEndHsmL=x;
      if(!maxEndHsmL||x.end_cycle_hsmL_um>maxEndHsmL.end_cycle_hsmL_um) maxEndHsmL=x;
    }
  }
  return Object.freeze({
    phase,
    cycles:r.length,
    startTimeS:r[0].time_s,
    endTimeS:r[r.length-1].time_s,
    meanPeakFbMnPerMm2:sumFb/r.length,
    meanStressRatio:sumRatio/r.length,
    mechanics:mechanicsCount?Object.freeze({
      meanCycleHsmLExcursionUm:sumExcursion/mechanicsCount,
      minCycleExcursion:Object.freeze({
        time_s:minExcursion.time_s,
        excursion_um:minExcursion.cycle_hsmL_excursion_um,
        peak_shortening_um:minExcursion.cycle_peak_shortening_um,
        end_hsmL_um:minExcursion.end_cycle_hsmL_um,
        peak_Fb_mN_per_mm2:minExcursion.peak_Fb_mN_per_mm2,
        stress_ratio:minExcursion.stress_ratio,
      }),
      maxCycleExcursion:Object.freeze({
        time_s:maxExcursion.time_s,
        excursion_um:maxExcursion.cycle_hsmL_excursion_um,
        peak_shortening_um:maxExcursion.cycle_peak_shortening_um,
        end_hsmL_um:maxExcursion.end_cycle_hsmL_um,
        peak_Fb_mN_per_mm2:maxExcursion.peak_Fb_mN_per_mm2,
        stress_ratio:maxExcursion.stress_ratio,
      }),
      shortestEndCycleHsmL:Object.freeze({
        time_s:minEndHsmL.time_s,
        end_hsmL_um:minEndHsmL.end_cycle_hsmL_um,
        excursion_um:minEndHsmL.cycle_hsmL_excursion_um,
        peak_Fb_mN_per_mm2:minEndHsmL.peak_Fb_mN_per_mm2,
      }),
      longestEndCycleHsmL:Object.freeze({
        time_s:maxEndHsmL.time_s,
        end_hsmL_um:maxEndHsmL.end_cycle_hsmL_um,
        excursion_um:maxEndHsmL.cycle_hsmL_excursion_um,
        peak_Fb_mN_per_mm2:maxEndHsmL.peak_Fb_mN_per_mm2,
      }),
    }):null,
    minPeakFb:Object.freeze({
      time_s:minFb.time_s,
      peak_Fb_mN_per_mm2:minFb.peak_Fb_mN_per_mm2,
      stress_ratio:minFb.stress_ratio,
      pHi:minFb.end_cycle_pHi,
      peak_Cyt_Cai_mM:minFb.peak_Cyt_Cai_mM,
      ATPTotal_mM:minFb.end_cycle_ATPTotal_mM,
      PCr_mM:minFb.end_cycle_PCr_mM,
      Pi_mM:minFb.end_cycle_Pi_mM,
      mechanics:Number.isFinite(minFb.cycle_hsmL_excursion_um)?Object.freeze({
        start_hsmL_um:minFb.start_cycle_hsmL_um,
        min_hsmL_um:minFb.min_cycle_hsmL_um,
        max_hsmL_um:minFb.max_cycle_hsmL_um,
        end_hsmL_um:minFb.end_cycle_hsmL_um,
        end_hsmX_um:minFb.end_cycle_hsmX_um,
        excursion_um:minFb.cycle_hsmL_excursion_um,
        peak_shortening_um:minFb.cycle_peak_shortening_um,
        net_hsmL_change_um:minFb.cycle_net_hsmL_change_um,
      }):null,
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
  const protocolName=run.provenance?.protocolName;
  const requestedTimes=protocolName==='ischemia'
    ? [179.6,180,180.4,1079.6,1080,1080.4,1140,1200]
    : protocolName==='acidosis'
      ? [299.6,300,300.4,899.6,900,900.4,930,960]
      : [rows[0].time_s,rows[rows.length-1].time_s];
  for(const t of requestedTimes){
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
      mechanics:Number.isFinite(x.cycle_hsmL_excursion_um)?Object.freeze({
        start_hsmL_um:x.start_cycle_hsmL_um,
        min_hsmL_um:x.min_cycle_hsmL_um,
        max_hsmL_um:x.max_cycle_hsmL_um,
        end_hsmL_um:x.end_cycle_hsmL_um,
        end_hsmX_um:x.end_cycle_hsmX_um,
        excursion_um:x.cycle_hsmL_excursion_um,
        peak_shortening_um:x.cycle_peak_shortening_um,
        net_hsmL_change_um:x.cycle_net_hsmL_change_um,
      }):null,
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
