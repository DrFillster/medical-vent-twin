'use strict';

const fs=require('fs');
const {
  LIVE_HUMMOD_REFERENCE_CASE_ID,
  createBerlinLiveHumModSession,
}=require('../../ards-twin-v1.0/src/clinical_twin_live_hummod_session.js');
const { mechanicsParams }=require('./fit_controlled_mechanics.js');

const BASE='/Users/philipbernard/mimic-data/derived';
const LOCK=BASE+'/primary60_ps_fio2_prefit_index.jsonl';
const PREFIT=BASE+'/primary60_conservative_prefit.json';
const START_INDEX=Number(process.env.START_INDEX||0);
const MAX_EVENTS=Number(process.env.MAX_EVENTS||1000);
const OUTPUT=process.env.OUTPUT||BASE+'/primary60_ps_fio2_composite_refit_part.jsonl';

const CO2_NUISANCE=[0.10,0.25,0.40,0.55,0.70,0.82];
const VPF=[0.50,0.60,0.70,0.80,0.85,0.90,0.95,1.00];
const SEARCH_SEC=900;
const CONFIRM_SEC=3600;

function loadJsonl(p){
  return fs.readFileSync(p,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
}
function sq(x){return x*x;}

const lock=loadJsonl(LOCK);
const allPrefit=JSON.parse(fs.readFileSync(PREFIT,'utf8'));
const prefit=new Map(allPrefit.map(x=>[x.event_id,x]));

const composite=lock.filter(x=>x.oxygenation_source_plan==='composite_effective_oxygenation');
if(composite.length!==19) throw new Error('expected exactly 19 composite-oxygenation events');
if(composite.some(x=>x.deadspace_source_plan!=='latent_prior_constrained')){
  throw new Error('composite lock contains unexpected measured dead-space event');
}
const selected=composite.slice(START_INDEX,START_INDEX+MAX_EVENTS);

function sessionFor(e,{co2Nuisance=0.40,vpf=0.85}={}){
  const x=prefit.get(e.event_id);
  if(!x) throw new Error('missing conservative prefit input');
  const p=x.prefit,v=x.vent;
  return createBerlinLiveHumModSession({
    caseId:LIVE_HUMMOD_REFERENCE_CASE_ID,
    ventilation:{
      mode:'PS',fio2:v.fio2_percent/100,peep:v.peep,rr:2,
      pressureSupportCmH2O:v.psv
    },
    initialRecruitmentState:{normal:1,recruitable:0.35,consolidated:0},
    patientStateProfile:'awake_cooperative',
    patientDriveRelativeOverride:p.drive,
    patientMuscleTransmissionOverride:p.muscle_transmission,
    patientMechanicsParams:mechanicsParams(p.stiffness_scale,p.resistance_scale),
    // This is an effective CO2-elimination nuisance parameter, not a claimed
    // physiologic VD/VT measurement in this non-identifiable cohort.
    patientDeadSpaceFractionOfTidalVolume:co2Nuisance,
    patientVentilatedPerfusionFractionOverride:vpf,
    patientArterialGasInitialization:{
      po2MmHg:x.targets.po2,pco2MmHg:x.targets.pco2,pH:x.targets.ph
    },
    dt:0.010,
    mechanicalWarmupSec:8,
    coupledEquilibrationSec:0,
    physicianValidationCandidate:false
  });
}

function advance(s,totalSec){
  s.initialize();
  const baseline=s.runFor(24);
  let elapsed=24;
  while(elapsed<totalSec){
    const step=Math.min(30,totalSec-elapsed);
    s.runFor(step);
    s.compactTraceHistory(60);
    elapsed+=step;
  }
  const final=s.snapshot();
  return {
    baseline:{
      po2:baseline.systemic.gasExchange.pao2MmHg,
      pco2:baseline.systemic.gasExchange.paco2MmHg
    },
    final:{
      po2:final.systemic.gasExchange.pao2MmHg,
      pco2:final.systemic.gasExchange.paco2MmHg
    }
  };
}

const out=[];
for(let i=0;i<selected.length;i++){
  const e=selected[i],x=prefit.get(e.event_id);
  let bestCo2=null;
  for(const d of CO2_NUISANCE){
    try{
      const r=advance(sessionFor(e,{co2Nuisance:d,vpf:0.85}),SEARCH_SEC);
      const score=sq((r.baseline.pco2-x.targets.pco2)/8)+
                  sq((r.final.pco2-x.targets.pco2)/8);
      if(!bestCo2||score<bestCo2.score) bestCo2={value:d,score,r};
    }catch(_){}
  }
  if(!bestCo2){
    out.push({event_id:e.event_id,status:'co2-search-failed'});
    continue;
  }

  let bestVpf=null;
  for(const vpf of VPF){
    try{
      const r=advance(sessionFor(e,{co2Nuisance:bestCo2.value,vpf}),SEARCH_SEC);
      const score=sq((r.baseline.po2-x.targets.po2)/20)+
                  sq((r.final.po2-x.targets.po2)/20);
      if(!bestVpf||score<bestVpf.score) bestVpf={value:vpf,score,r};
    }catch(_){}
  }
  if(!bestVpf){
    out.push({event_id:e.event_id,status:'oxygen-search-failed'});
    continue;
  }

  let c;
  try{
    c=advance(sessionFor(e,{co2Nuisance:bestCo2.value,vpf:bestVpf.value}),CONFIRM_SEC);
  }catch(err){
    out.push({event_id:e.event_id,status:'confirmation-failed',error:err.message});
    continue;
  }

  const basePco2=c.baseline.pco2-x.targets.pco2;
  const basePo2=c.baseline.po2-x.targets.po2;
  const driftPco2=c.final.pco2-c.baseline.pco2;
  const driftPo2=c.final.po2-c.baseline.po2;
  const pass=Math.abs(basePco2)<=8 && Math.abs(basePo2)<=20 &&
             Math.abs(driftPco2)<=8 && Math.abs(driftPo2)<=20;

  const row={
    event_id:e.event_id,status:'fit-complete',pass,
    fitted:{
      effective_co2_elimination_fraction:bestCo2.value,
      effective_ventilated_perfusion_fraction:bestVpf.value,
      drive:x.prefit.drive,
      muscle_transmission:x.prefit.muscle_transmission,
      stiffness_scale:x.prefit.stiffness_scale,
      resistance_scale:x.prefit.resistance_scale
    },
    residuals:{
      baseline_pco2:basePco2,baseline_po2:basePo2,
      drift_pco2_60:driftPco2,drift_po2_60:driftPo2
    },
    boundary_flags:{
      co2_nuisance:bestCo2.value===CO2_NUISANCE[0]||
                   bestCo2.value===CO2_NUISANCE[CO2_NUISANCE.length-1],
      oxygenation:bestVpf.value===VPF[0]||bestVpf.value===VPF[VPF.length-1]
    },
    provenance:{
      post_index_data_loaded:false,
      locked_index:'primary60_ps_fio2_prefit_index.jsonl',
      oxygenation_source_plan:'composite_effective_oxygenation',
      co2_parameter_interpretation:'effective-nuisance-not-physiologic-dead-space-estimate',
      tissue_co2_production:'model-prior-not-refit',
      search_horizon_sec:SEARCH_SEC,
      confirmation_horizon_sec:CONFIRM_SEC,
      mechanics_effort_fixed_from_primary60_prefit:true
    }
  };
  out.push(row);
  console.log('refit',START_INDEX+i+1+'/'+composite.length,e.event_id,
    'pass='+pass,
    'co2='+bestCo2.value,'vpf='+bestVpf.value,
    'baseCO2='+basePco2.toFixed(2),'baseO2='+basePo2.toFixed(2),
    'driftCO2='+driftPco2.toFixed(2),'driftO2='+driftPo2.toFixed(2));
}
fs.writeFileSync(OUTPUT,out.map(x=>JSON.stringify(x)).join('\n')+'\n');
console.log('wrote',OUTPUT,out.length);
