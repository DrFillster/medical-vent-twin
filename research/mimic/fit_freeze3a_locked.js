'use strict';

const fs=require('fs');
const {
  LIVE_HUMMOD_REFERENCE_CASE_ID,
  createBerlinLiveHumModSession,
}=require('../../ards-twin-v1.0/src/clinical_twin_live_hummod_session.js');
const {getBerlinCase}=require('../../ards-twin-v1.0/src/berlin_case_catalog.js');

const BASE='/Users/philipbernard/mimic-data/derived';
const INDEX=BASE+'/freeze3a_fio2_prefit_index.jsonl';
const START_INDEX=Number(process.env.START_INDEX||0);
const MAX_EVENTS=Number(process.env.MAX_EVENTS||5);
const OUTPUT=process.env.OUTPUT||BASE+'/freeze3a_locked_refit.jsonl';

function load(p){
  return fs.readFileSync(p,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
}
function clone(x){return JSON.parse(JSON.stringify(x));}
function sq(x){return x*x;}

function mechanicsParams(f,pclose){
  const c=getBerlinCase(LIVE_HUMMOD_REFERENCE_CASE_ID);
  const p=clone(c.phenotype.mechanicsParams);
  for(const comp of p.compartments) comp.elasticScale*=f.stiffness_scale;
  p.centralAirwayResistance=f.central_airway_resistance;

  // Freeze 3A protocol: fixed nonventilated perfusion is NOT refit here.
  const q=f.fixed_nonventilated_perfusion_fraction;
  const rem=1-q;
  for(const comp of p.compartments){
    if(comp.id==='normal') comp.perfusionFraction=rem*(55/85);
    else if(comp.id==='recruitable'){
      comp.perfusionFraction=rem*(30/85);
      comp.recruitment={...comp.recruitment,P_close:pclose,P_open:pclose+10};
    } else if(comp.id==='consolidated') comp.perfusionFraction=q;
  }
  return p;
}

function run(input,fit,pclose,deadFrac,totalSec,initialRecruitment){
  const f=fit.fitted,v=input.vent;
  const s=createBerlinLiveHumModSession({
    caseId:LIVE_HUMMOD_REFERENCE_CASE_ID,
    ventilation:{
      mode:'PS',fio2:v.fio2_percent/100,peep:v.peep,
      rr:v.backup_rate_prior,pressureSupportCmH2O:v.pressure_support
    },
    initialRecruitmentState:{normal:1,recruitable:initialRecruitment,consolidated:0},
    patientStateProfile:f.effort_profile,
    patientDriveRelativeOverride:f.hennigs_drive_relative,
    patientMechanicsParams:mechanicsParams(f,pclose),
    patientDeadSpaceFractionOfTidalVolume:deadFrac,
    patientArterialGasInitialization:{
      po2MmHg:input.targets.po2,
      pco2MmHg:input.targets.pco2,
      pH:input.targets.ph
    },
    dt:0.01,
    mechanicalWarmupSec:8,
    coupledEquilibrationSec:0,
    physicianValidationCandidate:false
  });
  s.initialize();
  const b=s.runFor(24),bg=b.systemic.gasExchange;
  let elapsed=24;
  while(elapsed<totalSec){
    const step=Math.min(30,totalSec-elapsed);
    s.runFor(step);
    s.compactTraceHistory(60);
    elapsed+=step;
  }
  const x=s.snapshot(),g=x.systemic.gasExchange;
  return {
    baseline:{po2:bg.pao2MmHg,pco2:bg.paco2MmHg},
    final:{po2:g.pao2MmHg,pco2:g.paco2MmHg},
    ventilatedPerfusionFraction:g.ventilatedPerfusionFraction
  };
}

const inputs=new Map(load(BASE+'/ps_fit_inputs.jsonl').map(x=>[x.event_id,x]));
let fitRows=[];
for(const p of fs.readdirSync(BASE).filter(x=>/^ps_fit_full_part.*\.jsonl$/.test(x)).sort()){
  fitRows=fitRows.concat(load(BASE+'/'+p));
}
const fits=new Map(fitRows.map(x=>[x.event_id,x]));
const fullDev=new Map(load(BASE+'/freeze3_dev_index.jsonl').map(x=>[x.event_id,x]));
const locked=load(INDEX);

// Fail closed against the protocol-locked cohort.
if(locked.length!==45) throw new Error('Freeze 3A locked index must contain exactly 45 rows');
const ids=locked.map(x=>x.event_id);
if(new Set(ids).size!==45) throw new Error('Freeze 3A locked index contains duplicate event IDs');
for(const e of locked){
  if(!['SPONT','CPAP/PSV','PSV/SBT'].includes(e.pre_mode)){
    throw new Error('Freeze 3A index contains unsupported mode');
  }
  if(!(Number.isFinite(e.effort_score)&&e.effort_score<=2)){
    throw new Error('Freeze 3A index violates effort-score gate');
  }
  const d=fullDev.get(e.event_id);
  if(!d||d.transition_itemid!==223835){
    throw new Error('Freeze 3A index contains non-FiO2 intervention');
  }
}
const selected=locked.slice(START_INDEX,START_INDEX+MAX_EVENTS);

const PCLOSE=[0,0.25,0.5,0.75,1,1.25,1.5,1.75,2];
const RGRID=[0.20,0.40,0.60,0.80,1.00];
const DGRID=[0.10,0.25,0.40,0.55,0.70,0.82];

const out=[];
for(let n=0;n<selected.length;n++){
  const e=selected[n];
  const input=inputs.get(e.event_id),fit=fits.get(e.event_id);
  if(!input||!fit||fit.status!=='fit-complete'){
    out.push({event_id:e.event_id,status:'missing-or-incomplete-fit'});
    continue;
  }

  const priorD=fit.fitted.dead_space_fraction_of_vt;

  // Stage 1: current recruited state, with threshold at lower protocol bound.
  let bestR=null;
  for(const rec of RGRID){
    try{
      const r=run(input,fit,0,priorD,900,rec);
      const score=sq((r.baseline.po2-input.targets.po2)/20)+
        sq((r.final.po2-input.targets.po2)/20);
      if(!bestR||score<bestR.score) bestR={rec,score,r};
    }catch(err){}
  }
  if(!bestR){
    out.push({event_id:e.event_id,status:'recruitment-state-search-failed'});
    continue;
  }

  // Stage 2: closing threshold with 10 cmH2O hysteresis width preserved.
  let bestP=null;
  for(const pclose of PCLOSE){
    try{
      const r=run(input,fit,pclose,priorD,900,bestR.rec);
      const score=sq((r.baseline.po2-input.targets.po2)/20)+
        sq((r.final.po2-input.targets.po2)/20);
      if(!bestP||score<bestP.score) bestP={pclose,score,r};
    }catch(err){}
  }
  if(!bestP){
    out.push({event_id:e.event_id,status:'threshold-search-failed'});
    continue;
  }

  // Stage 3: effective dead-space fraction for CO2 state/stationarity.
  let bestD=null;
  for(const d of DGRID){
    try{
      const r=run(input,fit,bestP.pclose,d,900,bestR.rec);
      const score=sq((r.baseline.pco2-input.targets.pco2)/8)+
        sq((r.final.pco2-input.targets.pco2)/8);
      if(!bestD||score<bestD.score) bestD={d,score,r};
    }catch(err){}
  }
  if(!bestD){
    out.push({event_id:e.event_id,status:'dead-space-search-failed'});
    continue;
  }

  let c;
  try{
    c=run(input,fit,bestP.pclose,bestD.d,3600,bestR.rec);
  }catch(err){
    out.push({event_id:e.event_id,status:'confirmation-failed',error:err.message});
    continue;
  }

  const rbco2=c.baseline.pco2-input.targets.pco2;
  const rbo2=c.baseline.po2-input.targets.po2;
  const dco2=c.final.pco2-c.baseline.pco2;
  const do2=c.final.po2-c.baseline.po2;
  const pass=
    Math.abs(rbco2)<=8 &&
    Math.abs(rbo2)<=20 &&
    Math.abs(dco2)<=8 &&
    Math.abs(do2)<=20;

  const row={
    event_id:e.event_id,
    status:'fit-complete',
    pass,
    fitted:{
      ...fit.fitted,
      // fixed_nonventilated_perfusion_fraction is carried unchanged from fit.
      recruitment_p_close:bestP.pclose,
      recruitment_p_open:bestP.pclose+10,
      baseline_recruitment_prior:bestR.rec,
      dead_space_fraction_of_vt:bestD.d
    },
    residuals:{
      baseline_pco2:rbco2,
      baseline_po2:rbo2,
      drift_pco2_60:dco2,
      drift_po2_60:do2
    },
    diagnostics:{
      ventilated_perf_60:c.ventilatedPerfusionFraction,
      recruitment_state_score_15m:bestR.score,
      oxygen_threshold_score_15m:bestP.score,
      co2_score_15m:bestD.score
    },
    provenance:{
      post_index_data_loaded:false,
      locked_index:'freeze3a_fio2_prefit_index.jsonl',
      search_method:'sequential-coordinate-v1',
      oxygen_search_horizon_sec:900,
      co2_search_horizon_sec:900,
      confirmation_horizon_sec:3600,
      hysteresis_width_preserved_cmH2O:10,
      recruitment_kinetics_preserved:true,
      fixed_nonventilated_perfusion_refit:false,
      mechanics_effort_fixed_from_prior_prefit:true
    }
  };
  out.push(row);
  console.log('refit',n+1+'/'+selected.length,e.event_id,'pass='+pass,
    'baseCO2='+rbco2.toFixed(2),'baseO2='+rbo2.toFixed(2),
    'driftCO2='+dco2.toFixed(2),'driftO2='+do2.toFixed(2));
}

fs.writeFileSync(OUTPUT,out.map(x=>JSON.stringify(x)).join('\n')+'\n');
console.log('wrote',OUTPUT,out.length);
