'use strict';

const fs=require('fs');
const duckdbPath='/Users/philipbernard/mimic-data/derived';
const {
  LIVE_HUMMOD_REFERENCE_CASE_ID,
  createBerlinLiveHumModSession,
}=require('../../ards-twin-v1.0/src/clinical_twin_live_hummod_session.js');
const {getBerlinCase}=require('../../ards-twin-v1.0/src/berlin_case_catalog.js');

const START_INDEX=Number(process.env.START_INDEX||0);
const MAX_EVENTS=Number(process.env.MAX_EVENTS||10);
const OUTPUT=process.env.OUTPUT||duckdbPath+'/blinded_predictions_part.jsonl';
const HORIZON_PROFILE=process.env.PREDICTION_HORIZON_PROFILE||'standard-60m';
const HORIZONS=HORIZON_PROFILE==='dense-180m'
  ? Array.from({length:36},(_,i)=>(i+1)*300)
  : [300,900,1800,3600];

function loadJsonl(p){
  if(!fs.existsSync(p)) return [];
  return fs.readFileSync(p,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
}
function finite(x){return typeof x==='number'&&Number.isFinite(x);}
function clone(x){return JSON.parse(JSON.stringify(x));}

function mechanicsParams(f){
  const c=getBerlinCase(LIVE_HUMMOD_REFERENCE_CASE_ID);
  const p=clone(c.phenotype.mechanicsParams);
  for(const comp of p.compartments) comp.elasticScale*=f.stiffness_scale;
  p.centralAirwayResistance=f.central_airway_resistance;
  const qCon=f.fixed_nonventilated_perfusion_fraction;
  const rem=1-qCon;
  const qN=rem*(55/85), qR=rem*(30/85);
  for(const comp of p.compartments){
    if(comp.id==='normal') comp.perfusionFraction=qN;
    else if(comp.id==='recruitable') comp.perfusionFraction=qR;
    else if(comp.id==='consolidated') comp.perfusionFraction=qCon;
  }
  return p;
}

function controlledVent(row){
  const v=row.vent;
  if(row.hummod_mode==='VC_AC'){
    return {
      mode:'VC_AC',fio2:v.fio2_percent/100,peep:v.peep,rr:v.rr_set,
      vtL:v.vt_set_ml/1000,inspiratoryFlowLps:v.flow_lps,inspiratoryPauseSec:0
    };
  }
  return {
    mode:'PC_AC',fio2:v.fio2_percent/100,peep:v.peep,rr:v.rr_set,
    pinspCmH2O:v.pinsp,inspiratoryTimeSec:v.inspiratory_time_sec,
    inspiratoryPauseSec:0
  };
}
function psVent(row){
  const v=row.vent;
  return {
    mode:'PS',fio2:v.fio2_percent/100,peep:v.peep,
    rr:v.backup_rate_prior,pressureSupportCmH2O:v.pressure_support
  };
}
function applyTransition(vent,itemid,newValue){
  const x={...vent};
  if(itemid===223835) x.fio2=newValue>1?newValue/100:newValue;
  else if(itemid===220339) x.peep=newValue;
  else if(itemid===224688) x.rr=newValue;
  else if(itemid===224684){
    if(x.mode!=='VC_AC') throw new Error('VT transition requires VC_AC');
    x.vtL=newValue/1000;
  } else throw new Error('unsupported transition item '+itemid);
  return x;
}

function snapshotPrediction(s,horizonSec){
  const g=s.systemic.gasExchange;
  const h=s.systemic.hemodynamics;
  const b=s.pulmonary.measurements.lastValidDeliveredBreath||
          s.pulmonary.measurements.lastCompletedBreath;
  return {
    horizon_sec:horizonSec,
    pao2_mmHg:g&&g.pao2MmHg,
    paco2_mmHg:g&&g.paco2MmHg,
    ph:g&&g.pH,
    sao2_percent:g&&g.sao2Fraction*100,
    hr_per_min:h&&h.heartRatePerMin,
    map_mmHg:h&&h.meanArterialPressureMmHg,
    cardiac_output_ml_min:h&&h.cardiacOutputMlPerMin,
    vt_ml:b&&b.VtInspired*1000,
    minute_volume_l_min:b&&b.MV,
    peak_pressure_cmh2o:b&&b.Ppeak
  };
}

// Inputs containing only pre-transition measurements/phenotype parameters.
const ctrlInputs=new Map(loadJsonl(duckdbPath+'/controlled_fit_inputs.jsonl').map(x=>[x.event_id,x]));
const psInputs=new Map(loadJsonl(duckdbPath+'/ps_fit_inputs.jsonl').map(x=>[x.event_id,x]));
const ctrlFits=new Map(loadJsonl(duckdbPath+'/controlled_fit_results.jsonl').map(x=>[x.event_id,x]));
let psRows=[];
for(const p of fs.readdirSync(duckdbPath).filter(x=>/^ps_fit_full_part.*\.jsonl$/.test(x)).sort()){
  psRows=psRows.concat(loadJsonl(duckdbPath+'/'+p));
}
const psFits=new Map(psRows.map(x=>[x.event_id,x]));

// Local event bridge intentionally contains intervention identity/value but no post-outcome values.
// Export a minimal JSON bridge with Python before invoking this runner.
const eventIndex=loadJsonl(duckdbPath+'/blinded_event_index.jsonl');
const selected=eventIndex.filter(x=>x.representability==='well-represented')
  .slice(START_INDEX,START_INDEX+MAX_EVENTS);

const out=[];
for(let i=0;i<selected.length;i++){
  const e=selected[i];
  const isPS=e.fit_domain==='PS';
  const input=(isPS?psInputs:ctrlInputs).get(e.event_id);
  const fit=(isPS?psFits:ctrlFits).get(e.event_id);
  if(!input||!fit){
    out.push({event_id:e.event_id,status:'missing-fit-input'});
    continue;
  }
  try{
    const vent=isPS?psVent(input):controlledVent(input);
    const f=fit.fitted;
    const session=createBerlinLiveHumModSession({
      caseId:LIVE_HUMMOD_REFERENCE_CASE_ID,
      ventilation:vent,
      initialRecruitmentState:{
        normal:1,
        recruitable:finite(f.baseline_recruitment_prior)?f.baseline_recruitment_prior:0.35,
        consolidated:0
      },
      patientStateProfile:isPS?f.effort_profile:'awake_cooperative',
      patientDriveRelativeOverride:isPS?f.hennigs_drive_relative:null,
      patientMechanicsParams:mechanicsParams(f),
      patientDeadSpaceFractionOfTidalVolume:f.dead_space_fraction_of_vt,
      patientArterialGasInitialization:{
        po2MmHg:input.targets.po2,
        pco2MmHg:input.targets.pco2,
        pH:input.targets.ph
      },
      dt:0.01,
      mechanicalWarmupSec:isPS?8:5,
      coupledEquilibrationSec:0,
      physicianValidationCandidate:false
    });
    session.initialize();
    const pre=session.runFor(isPS?24:16);
    const preSnap=snapshotPrediction(pre,0);
    const next=applyTransition(vent,e.transition_itemid,e.transition_post_value);
    session.requestVentilationChange(next);
    const predictions=[];
    let elapsed=0;
    for(const horizon of HORIZONS){
      let remaining=horizon-elapsed;
      while(remaining>0){
        const step=Math.min(30,remaining);
        session.runFor(step);
        session.compactTraceHistory(60);
        remaining-=step;
      }
      elapsed=horizon;
      predictions.push(snapshotPrediction(session.snapshot(),horizon));
    }
    out.push({
      event_id:e.event_id,
      fit_domain:e.fit_domain,
      mode:e.hummod_mode,
      transition_itemid:e.transition_itemid,
      status:'predicted',
      baseline:preSnap,
      predictions,
      provenance:{
        post_outcome_data_loaded:false,
        phenotype_schema_version:e.phenotype_schema_version,
        phenotype_commit:e.code_commit,
        prediction_horizon_profile:HORIZON_PROFILE,
        prediction_horizons_sec:HORIZONS,
        runtime_dt_sec:0.01,
        physician_validation_candidate_enabled:false
      }
    });
    console.log('predicted',i+1+'/'+selected.length,e.fit_domain,e.hummod_mode,e.transition_itemid);
  }catch(err){
    out.push({event_id:e.event_id,status:'prediction-failed',error:err.message});
    console.log('failed',i+1+'/'+selected.length,err.message);
    if(process.env.DEBUG_STACK==='1') console.log(err.stack);
  }
}
fs.writeFileSync(OUTPUT,out.map(x=>JSON.stringify(x)).join('\n')+'\n');
console.log('wrote',OUTPUT,'events',out.length);
