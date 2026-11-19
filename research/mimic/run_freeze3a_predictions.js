'use strict';

const fs=require('fs');
const {execFileSync}=require('child_process');
const {
  LIVE_HUMMOD_REFERENCE_CASE_ID,
  createBerlinLiveHumModSession,
}=require('../../ards-twin-v1.0/src/clinical_twin_live_hummod_session.js');
const {getBerlinCase}=require('../../ards-twin-v1.0/src/berlin_case_catalog.js');

const BASE='/Users/philipbernard/mimic-data/derived';
const START_INDEX=Number(process.env.START_INDEX||0);
const MAX_EVENTS=Number(process.env.MAX_EVENTS||1000);
const OUTPUT=process.env.OUTPUT||BASE+'/freeze3a_predictions_part.jsonl';
// Freeze 3A follows the locked <=60-minute primary validation horizon.
// Longer frozen-phenotype trajectories are not part of this freeze.
const HORIZONS=Array.from({length:12},(_,i)=>(i+1)*300);
const PREDICTION_COMMIT=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();

function load(p){
  if(!fs.existsSync(p)) return [];
  return fs.readFileSync(p,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
}
function clone(x){return JSON.parse(JSON.stringify(x));}
function finite(x){return typeof x==='number'&&Number.isFinite(x);}

function mechanicsParams(f){
  const c=getBerlinCase(LIVE_HUMMOD_REFERENCE_CASE_ID);
  const p=clone(c.phenotype.mechanicsParams);
  for(const comp of p.compartments) comp.elasticScale*=f.stiffness_scale;
  p.centralAirwayResistance=f.central_airway_resistance;

  const q=f.fixed_nonventilated_perfusion_fraction;
  const rem=1-q;
  for(const comp of p.compartments){
    if(comp.id==='normal') comp.perfusionFraction=rem*(55/85);
    else if(comp.id==='recruitable'){
      comp.perfusionFraction=rem*(30/85);
      comp.recruitment={
        ...comp.recruitment,
        P_close:f.recruitment_p_close,
        P_open:f.recruitment_p_open
      };
    } else if(comp.id==='consolidated') comp.perfusionFraction=q;
  }
  return p;
}

function psVent(input){
  const v=input.vent;
  return {
    mode:'PS',
    fio2:v.fio2_percent/100,
    peep:v.peep,
    rr:v.backup_rate_prior,
    pressureSupportCmH2O:v.pressure_support
  };
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

const inputs=new Map(load(BASE+'/ps_fit_inputs.jsonl').map(x=>[x.event_id,x]));
const refitRows=load(BASE+'/freeze3a_locked_refit.jsonl');
const refits=new Map(refitRows.map(x=>[x.event_id,x]));
const index=load(BASE+'/freeze3a_event_index.jsonl');

const passIds=new Set(refitRows.filter(r=>r.status==='fit-complete'&&r.pass===true).map(r=>r.event_id));
const indexIds=index.map(r=>r.event_id);
if(new Set(indexIds).size!==indexIds.length) throw new Error('duplicate Freeze 3A prediction index IDs');
if(indexIds.length!==passIds.size || indexIds.some(id=>!passIds.has(id))){
  throw new Error('Freeze 3A prediction index must exactly equal refit pass set');
}
for(const e of index){
  if(e.transition_itemid!==223835) throw new Error('Freeze 3A prediction index contains non-FiO2 transition');
}

const selected=index.slice(START_INDEX,START_INDEX+MAX_EVENTS);
const out=[];

for(let i=0;i<selected.length;i++){
  const e=selected[i];
  const input=inputs.get(e.event_id);
  const refit=refits.get(e.event_id);
  if(!input||!refit||refit.status!=='fit-complete'||refit.pass!==true){
    out.push({event_id:e.event_id,status:'missing-or-ineligible-refit'});
    continue;
  }

  try{
    const f=refit.fitted;
    const vent=psVent(input);
    const session=createBerlinLiveHumModSession({
      caseId:LIVE_HUMMOD_REFERENCE_CASE_ID,
      ventilation:vent,
      initialRecruitmentState:{
        normal:1,
        recruitable:f.baseline_recruitment_prior,
        consolidated:0
      },
      patientStateProfile:f.effort_profile,
      patientDriveRelativeOverride:f.hennigs_drive_relative,
      patientMechanicsParams:mechanicsParams(f),
      patientDeadSpaceFractionOfTidalVolume:f.dead_space_fraction_of_vt,
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

    session.initialize();
    const pre=session.runFor(24);
    const baseline=snapshotPrediction(pre,0);

    const next={...vent,fio2:e.transition_post_value>1
      ? e.transition_post_value/100
      : e.transition_post_value};
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
      fit_domain:'PS',
      mode:'PS',
      pre_mode:e.pre_mode,
      transition_itemid:223835,
      status:'predicted',
      baseline,
      predictions,
      provenance:{
        post_outcome_data_loaded:false,
        freeze:'Freeze 3A',
        locked_refit_pass:true,
        phenotype_fit_commit:refit.provenance&&refit.provenance.phenotype_fit_commit,
        prediction_runtime_commit:PREDICTION_COMMIT,
        prediction_horizons_sec:HORIZONS,
        runtime_dt_sec:0.01,
        physician_validation_candidate_enabled:false
      }
    });
    console.log('predicted',i+1+'/'+selected.length,e.event_id);
  }catch(err){
    out.push({event_id:e.event_id,status:'prediction-failed',error:err.message});
    console.log('failed',i+1+'/'+selected.length,err.message);
  }
}

fs.writeFileSync(OUTPUT,out.map(x=>JSON.stringify(x)).join('\n')+'\n');
console.log('wrote',OUTPUT,'events',out.length);
