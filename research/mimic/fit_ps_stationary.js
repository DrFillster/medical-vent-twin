'use strict';

const fs=require('fs');
const {
  LIVE_HUMMOD_REFERENCE_CASE_ID,
  createBerlinLiveHumModSession,
}=require('../../ards-twin-v1.0/src/clinical_twin_live_hummod_session.js');
const {getBerlinCase}=require('../../ards-twin-v1.0/src/berlin_case_catalog.js');

const BASE='/Users/philipbernard/mimic-data/derived';
const START_INDEX=Number(process.env.START_INDEX||0);
const MAX_EVENTS=Number(process.env.MAX_EVENTS||5);
const OUTPUT=process.env.OUTPUT||BASE+'/freeze3a_stationary_refit.jsonl';
const INDEX=process.env.INDEX||BASE+'/freeze3a_fio2_prefit_index.jsonl';

function load(p){return fs.readFileSync(p,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);}
function finite(x){return typeof x==='number'&&Number.isFinite(x);}
function clone(x){return JSON.parse(JSON.stringify(x));}

function mechanicsParams(f){
  const c=getBerlinCase(LIVE_HUMMOD_REFERENCE_CASE_ID);
  const p=clone(c.phenotype.mechanicsParams);
  for(const comp of p.compartments) comp.elasticScale*=f.stiffness_scale;
  p.centralAirwayResistance=f.central_airway_resistance;
  const qCon=f.fixed_nonventilated_perfusion_fraction;
  const rem=1-qCon;
  for(const comp of p.compartments){
    if(comp.id==='normal') comp.perfusionFraction=rem*(55/85);
    else if(comp.id==='recruitable') comp.perfusionFraction=rem*(30/85);
    else if(comp.id==='consolidated') comp.perfusionFraction=qCon;
  }
  return p;
}

function buildSession(input,fit,qCon,deadFrac,baselineRecruitment=0.35){
  const f={...fit.fitted,fixed_nonventilated_perfusion_fraction:qCon,dead_space_fraction_of_vt:deadFrac};
  const v=input.vent;
  return createBerlinLiveHumModSession({
    caseId:LIVE_HUMMOD_REFERENCE_CASE_ID,
    ventilation:{
      mode:'PS',fio2:v.fio2_percent/100,peep:v.peep,
      rr:v.backup_rate_prior,pressureSupportCmH2O:v.pressure_support
    },
    initialRecruitmentState:{normal:1,recruitable:baselineRecruitment,consolidated:0},
    patientStateProfile:f.effort_profile,
    patientDriveRelativeOverride:f.hennigs_drive_relative,
    patientMechanicsParams:mechanicsParams(f),
    patientDeadSpaceFractionOfTidalVolume:deadFrac,
    patientArterialGasInitialization:{
      po2MmHg:input.targets.po2,pco2MmHg:input.targets.pco2,pH:input.targets.ph
    },
    dt:0.01,mechanicalWarmupSec:8,coupledEquilibrationSec:0,
    physicianValidationCandidate:false
  });
}

function gasSnap(s){
  const g=s.systemic.gasExchange;
  return {po2:g.pao2MmHg,pco2:g.paco2MmHg,ph:g.pH};
}
function term(x,t,scale){const z=(x-t)/scale;return z*z;}

function runTo(input,fit,qCon,deadFrac,totalSec,baselineRecruitment=0.35){
  const session=buildSession(input,fit,qCon,deadFrac,baselineRecruitment);
  session.initialize();
  const b=gasSnap(session.runFor(24));
  let elapsed=24;
  while(elapsed<totalSec){
    const step=Math.min(30,totalSec-elapsed);
    session.runFor(step); session.compactTraceHistory(60); elapsed+=step;
  }
  return {baseline:b,final:gasSnap(session.snapshot())};
}

function scoreO2(input,out){
  return term(out.baseline.po2,input.targets.po2,20)+term(out.final.po2,input.targets.po2,20);
}
function scoreCO2(input,out){
  return term(out.baseline.pco2,input.targets.pco2,8)+term(out.final.pco2,input.targets.pco2,8);
}

const psInputs=new Map(load(BASE+'/ps_fit_inputs.jsonl').map(x=>[x.event_id,x]));
let psRows=[];
for(const p of fs.readdirSync(BASE).filter(x=>/^ps_fit_full_part.*\.jsonl$/.test(x)).sort()) psRows=psRows.concat(load(BASE+'/'+p));
const psFits=new Map(psRows.map(x=>[x.event_id,x]));
const fullDev=new Map(load(BASE+'/freeze3_dev_index.jsonl').map(x=>[x.event_id,x]));
const lockedIndex=load(INDEX);
const lockedIds=lockedIndex.map(x=>x.event_id);
if(new Set(lockedIds).size!==lockedIds.length) throw new Error('Freeze 3A locked index contains duplicate event IDs');
for(const e of lockedIndex){
  if(!['SPONT','CPAP/PSV','PSV/SBT'].includes(e.pre_mode)) throw new Error('Freeze 3A index contains unsupported mode');
  if(!(Number.isFinite(e.effort_score)&&e.effort_score<=2)) throw new Error('Freeze 3A index violates effort-score gate');
  const d=fullDev.get(e.event_id);
  if(!d||d.transition_itemid!==223835) throw new Error('Freeze 3A index contains non-FiO2 intervention');
}
const dev=lockedIndex.slice(START_INDEX,START_INDEX+MAX_EVENTS);

const QGRID=[0.02,0.08,0.15,0.25,0.40,0.55];
const DGRID=[0.10,0.25,0.40,0.55,0.70,0.82];
const RGRID=[0.10,0.35,0.60,0.85,1.00];

const results=[];
for(let n=0;n<dev.length;n++){
  const e=dev[n],input=psInputs.get(e.event_id),fit=psFits.get(e.event_id);
  if(!input||!fit||fit.status!=='fit-complete'){
    results.push({event_id:e.event_id,status:'missing-or-incomplete-fit'}); continue;
  }
  const priorQ=fit.fitted.fixed_nonventilated_perfusion_fraction;
  const priorD=fit.fitted.dead_space_fraction_of_vt;

  let bestQ=null;
  for(const q of QGRID){
    try{
      const out=runTo(input,fit,q,priorD,900);
      const score=scoreO2(input,out);
      if(!bestQ||score<bestQ.score) bestQ={q,score,out};
    }catch(err){}
  }
  if(!bestQ){results.push({event_id:e.event_id,status:'oxygen-search-failed'});continue;}

  let bestR=null;
  for(const rec of RGRID){
    try{
      const out=runTo(input,fit,bestQ.q,priorD,900,rec);
      const score=scoreO2(input,out);
      if(!bestR||score<bestR.score) bestR={rec,score,out};
    }catch(err){}
  }
  if(!bestR){results.push({event_id:e.event_id,status:'recruitment-search-failed'});continue;}

  // Re-optimize fixed nonventilated perfusion after recruitment changes.
  bestQ=null;
  for(const q of QGRID){
    try{
      const out=runTo(input,fit,q,priorD,900,bestR.rec);
      const score=scoreO2(input,out);
      if(!bestQ||score<bestQ.score) bestQ={q,score,out};
    }catch(err){}
  }
  if(!bestQ){results.push({event_id:e.event_id,status:'oxygen-refine-failed'});continue;}

  let bestD=null;
  for(const d of DGRID){
    try{
      const out=runTo(input,fit,bestQ.q,d,900,bestR.rec);
      const score=scoreCO2(input,out);
      if(!bestD||score<bestD.score) bestD={d,score,out};
    }catch(err){}
  }
  if(!bestD){results.push({event_id:e.event_id,status:'co2-search-failed'});continue;}

  let confirm;
  try{confirm=runTo(input,fit,bestQ.q,bestD.d,3600,bestR.rec);}
  catch(err){results.push({event_id:e.event_id,status:'confirm-failed',error:err.message});continue;}

  const basePco2=confirm.baseline.pco2-input.targets.pco2;
  const basePo2=confirm.baseline.po2-input.targets.po2;
  const driftPco2=confirm.final.pco2-confirm.baseline.pco2;
  const driftPo2=confirm.final.po2-confirm.baseline.po2;
  const pass=Math.abs(basePco2)<=8&&Math.abs(basePo2)<=20&&Math.abs(driftPco2)<=8&&Math.abs(driftPo2)<=20;
  const r={
    event_id:e.event_id,status:'fit-complete',pass,
    fitted:{...fit.fitted,
      fixed_nonventilated_perfusion_fraction:bestQ.q,
      dead_space_fraction_of_vt:bestD.d,
      baseline_recruitment_prior:bestR.rec},
    residuals:{
      baseline_pco2:basePco2,baseline_po2:basePo2,
      drift_pco2_60:driftPco2,drift_po2_60:driftPo2},
    search:{oxygen_score_15m:bestQ.score,recruitment_score_15m:bestR.score,co2_score_15m:bestD.score},
    provenance:{
      post_index_data_loaded:false,
      development_set:'Freeze3 outcome-unseen',
      oxygen_search_horizon_sec:900,
      co2_search_horizon_sec:900,
      confirmation_horizon_sec:3600,
      mechanics_effort_fixed_from_prior_prefit:true
    }
  };
  results.push(r);
  console.log('refit',n+1+'/'+dev.length,e.event_id,'pass='+pass,
    'baseCO2='+basePco2.toFixed(2),'baseO2='+basePo2.toFixed(2),
    'driftCO2='+driftPco2.toFixed(2),'driftO2='+driftPo2.toFixed(2));
}
fs.writeFileSync(OUTPUT,results.map(x=>JSON.stringify(x)).join('\n')+'\n');
console.log('wrote',OUTPUT,results.length);
