'use strict';

const fs=require('fs');
const base='/Users/philipbernard/mimic-data/derived';
const {
  LIVE_HUMMOD_REFERENCE_CASE_ID,
  createBerlinLiveHumModSession,
}=require('../../ards-twin-v1.0/src/clinical_twin_live_hummod_session.js');
const {getBerlinCase}=require('../../ards-twin-v1.0/src/berlin_case_catalog.js');

const START_INDEX=Number(process.env.START_INDEX||0);
const MAX_EVENTS=Number(process.env.MAX_EVENTS||20);
const OUTPUT=process.env.OUTPUT||base+'/stationarity_part.jsonl';
const HORIZONS=[300,900,1800,3600];

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
function controlledVent(row){
  const v=row.vent;
  if(row.hummod_mode==='VC_AC') return {
    mode:'VC_AC',fio2:v.fio2_percent/100,peep:v.peep,rr:v.rr_set,
    vtL:v.vt_set_ml/1000,inspiratoryFlowLps:v.flow_lps,inspiratoryPauseSec:0
  };
  return {
    mode:'PC_AC',fio2:v.fio2_percent/100,peep:v.peep,rr:v.rr_set,
    pinspCmH2O:v.pinsp,inspiratoryTimeSec:v.inspiratory_time_sec,inspiratoryPauseSec:0
  };
}
function psVent(row){
  const v=row.vent;
  return {mode:'PS',fio2:v.fio2_percent/100,peep:v.peep,
    rr:v.backup_rate_prior,pressureSupportCmH2O:v.pressure_support};
}
function snap(s,h){
  const g=s.systemic.gasExchange;
  const hemo=s.systemic.hemodynamics;
  const b=s.pulmonary.measurements.lastValidDeliveredBreath||
          s.pulmonary.measurements.lastCompletedBreath;
  return {
    horizon_sec:h,pao2_mmHg:g&&g.pao2MmHg,paco2_mmHg:g&&g.paco2MmHg,ph:g&&g.pH,
    sao2_percent:g&&g.sao2Fraction*100,hr_per_min:hemo&&hemo.heartRatePerMin,
    map_mmHg:hemo&&hemo.meanArterialPressureMmHg,
    vt_ml:b&&b.VtInspired*1000,minute_volume_l_min:b&&b.MV
  };
}

const ctrlInputs=new Map(load(base+'/controlled_fit_inputs.jsonl').map(x=>[x.event_id,x]));
const psInputs=new Map(load(base+'/ps_fit_inputs.jsonl').map(x=>[x.event_id,x]));
const ctrlFits=new Map(load(base+'/controlled_fit_results.jsonl').map(x=>[x.event_id,x]));
let psRows=[]; for(const p of fs.readdirSync(base).filter(x=>/^ps_fit_full_part.*\.jsonl$/.test(x)).sort()) psRows=psRows.concat(load(base+'/'+p));
const psFits=new Map(psRows.map(x=>[x.event_id,x]));
const eventIndexPath=process.env.EVENT_INDEX||base+'/blinded_event_index.jsonl';
const requireRepresentability=process.env.REQUIRE_REPRESENTABILITY!=='0';
const events=load(eventIndexPath)
  .filter(x=>!requireRepresentability || x.representability==='well-represented')
  .slice(START_INDEX,START_INDEX+MAX_EVENTS);

const out=[];
for(const e of events){
  const isPS=e.fit_domain==='PS';
  const input=(isPS?psInputs:ctrlInputs).get(e.event_id);
  const fit=(isPS?psFits:ctrlFits).get(e.event_id);
  if(!input||!fit){out.push({event_id:e.event_id,status:'missing'});continue;}
  try{
    const f=fit.fitted;
    const session=createBerlinLiveHumModSession({
      caseId:LIVE_HUMMOD_REFERENCE_CASE_ID,
      ventilation:isPS?psVent(input):controlledVent(input),
      initialRecruitmentState:{normal:1,recruitable:finite(f.baseline_recruitment_prior)?f.baseline_recruitment_prior:0.35,consolidated:0},
      patientStateProfile:isPS?f.effort_profile:'awake_cooperative',
      patientDriveRelativeOverride:isPS?f.hennigs_drive_relative:null,
      patientMechanicsParams:mechanicsParams(f),
      patientDeadSpaceFractionOfTidalVolume:f.dead_space_fraction_of_vt,
      patientArterialGasInitialization:{po2MmHg:input.targets.po2,pco2MmHg:input.targets.pco2,pH:input.targets.ph},
      dt:0.01,mechanicalWarmupSec:isPS?8:5,coupledEquilibrationSec:0,physicianValidationCandidate:false
    });
    session.initialize();
    const pre=session.runFor(isPS?24:16);
    const baseline=snap(pre,0);
    let elapsed=0; const trajectory=[];
    for(const h of HORIZONS){
      let rem=h-elapsed;
      while(rem>0){const step=Math.min(30,rem);session.runFor(step);session.compactTraceHistory(60);rem-=step;}
      elapsed=h; trajectory.push(snap(session.snapshot(),h));
    }
    out.push({event_id:e.event_id,mode:e.hummod_mode,status:'ok',baseline,trajectory});
  }catch(err){out.push({event_id:e.event_id,mode:e.hummod_mode,status:'failed',error:err.message});}
}
fs.writeFileSync(OUTPUT,out.map(x=>JSON.stringify(x)).join('\n')+'\n');
console.log('wrote',OUTPUT,out.length);
