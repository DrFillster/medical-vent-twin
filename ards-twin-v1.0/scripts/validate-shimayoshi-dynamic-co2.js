#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {
  PINNED_SHA,
  SCHEDULE,
}=require('./patch-shimayoshi-dynamic-co2-validation.js');

const HEADER=Object.freeze([
  'time_s',
  'protocol',
  'peak_Fb_mN_per_mm2',
  'end_cycle_pHi',
  'end_cycle_ExtCell_O2o_mM',
  'end_cycle_O2i_mM',
  'end_cycle_ATPTotal_mM',
  'end_cycle_PCr_mM',
  'end_cycle_Pi_mM',
  'peak_Cyt_Cai_mM',
  'source_CO2_percent',
]);

function finite(value,label){
  const n=Number(value);
  if(!Number.isFinite(n)) throw new Error(label+' must be finite');
  return n;
}

function expectedAt(timeS){
  for(const s of SCHEDULE){
    if(timeS>=s.startS&&(s.endS==null||timeS<s.endS)) return s;
  }
  throw new Error('time outside validation schedule');
}

function parseCsv(text){
  const lines=text.trim().split(/\r?\n/).filter(Boolean);
  if(lines.length<2) throw new Error('dynamic source CSV must contain data');
  const header=lines[0].split(',').map(x=>x.trim());
  if(header.length!==HEADER.length||HEADER.some((x,i)=>header[i]!==x)){
    throw new Error('dynamic source CSV header mismatch');
  }
  return lines.slice(1).map((line,rowIndex)=>{
    const vals=line.split(',').map(x=>x.trim());
    if(vals.length!==HEADER.length){
      throw new Error('dynamic CSV row '+(rowIndex+2)+' column mismatch');
    }
    const row={};
    HEADER.forEach((h,i)=>row[h]=vals[i]);
    for(const h of HEADER.filter(h=>h!=='protocol')) row[h]=finite(row[h],h);
    return row;
  });
}

function validate({csvText,manifest}={}){
  if(!manifest||manifest.upstreamGitSha!==PINNED_SHA){
    throw new Error('dynamic source manifest must use pinned upstream SHA');
  }
  if(manifest.physiologyChanged!==false){
    throw new Error('dynamic source physiologyChanged must be false');
  }
  if(manifest.stimulusScheduleChanged!==true){
    throw new Error('dynamic source manifest must declare stimulusScheduleChanged true');
  }

  const rows=parseCsv(csvText);
  for(let i=1;i<rows.length;i++){
    if(!(rows[i].time_s>rows[i-1].time_s)){
      throw new Error('dynamic source time_s must increase strictly');
    }
  }

  let mismatches=0;
  for(const row of rows){
    const e=expectedAt(row.time_s);
    if(Math.abs(row.source_CO2_percent-e.co2Percent)>1e-9) mismatches+=1;
    if(row.protocol!==e.phase) mismatches+=1;
  }
  if(mismatches) throw new Error('dynamic source stimulus/phase schedule mismatch');

  const controls=rows.filter(r=>r.time_s<300);
  if(!controls.length) throw new Error('dynamic source prechallenge control rows are required');
  const referencePeakFb=
    controls.reduce((s,r)=>s+r.peak_Fb_mN_per_mm2,0)/controls.length;
  if(!(referencePeakFb>0)) throw new Error('dynamic source control peak Fb must be > 0');

  const segments=SCHEDULE.map(segment=>{
    const r=rows.filter(row=>
      row.time_s>=segment.startS&&
      (segment.endS==null||row.time_s<segment.endS)
    );
    if(!r.length) return null;
    let min=r[0],max=r[0];
    let sum=0;
    for(const x of r){
      if(x.peak_Fb_mN_per_mm2<min.peak_Fb_mN_per_mm2) min=x;
      if(x.peak_Fb_mN_per_mm2>max.peak_Fb_mN_per_mm2) max=x;
      sum+=x.peak_Fb_mN_per_mm2/referencePeakFb;
    }
    return Object.freeze({
      ...segment,
      rowCount:r.length,
      firstTimeS:r[0].time_s,
      lastTimeS:r[r.length-1].time_s,
      meanStressRatio:sum/r.length,
      minStressRatio:min.peak_Fb_mN_per_mm2/referencePeakFb,
      minStressTimeS:min.time_s,
      maxStressRatio:max.peak_Fb_mN_per_mm2/referencePeakFb,
      maxStressTimeS:max.time_s,
      endStressRatio:r[r.length-1].peak_Fb_mN_per_mm2/referencePeakFb,
      endPHi:r[r.length-1].end_cycle_pHi,
    });
  }).filter(Boolean);

  return Object.freeze({
    status:'shimayoshi-dynamic-co2-source-validation-complete',
    upstreamGitSha:PINNED_SHA,
    referencePeakFbMnPerMm2:referencePeakFb,
    rows:Object.freeze(rows.map(r=>Object.freeze({
      ...r,
      stress_ratio:r.peak_Fb_mN_per_mm2/referencePeakFb,
    }))),
    segments:Object.freeze(segments),
    physiologyChanged:false,
    stimulusScheduleChanged:true,
    closedLoopAuthority:false,
  });
}

function main(argv=process.argv.slice(2)){
  const [csvPath,manifestPath,outputPath]=argv;
  if(!csvPath||!manifestPath){
    throw new Error('usage: validate-shimayoshi-dynamic-co2.js <csv> <manifest.json> [output.json]');
  }
  const result=validate({
    csvText:fs.readFileSync(path.resolve(csvPath),'utf8'),
    manifest:JSON.parse(fs.readFileSync(path.resolve(manifestPath),'utf8')),
  });
  const out=JSON.stringify(result,null,2)+'\n';
  if(outputPath) fs.writeFileSync(path.resolve(outputPath),out);
  else process.stdout.write(out);
}

if(require.main===module){
  try{main();}
  catch(error){console.error(error.stack||error.message);process.exitCode=1;}
}

module.exports=Object.freeze({HEADER,expectedAt,parseCsv,validate});
