'use strict';

const fs=require('fs');
const {
  LIVE_HUMMOD_REFERENCE_CASE_ID,
  createBerlinLiveHumModSession,
}=require('../../ards-twin-v1.0/src/clinical_twin_live_hummod_session.js');
const { mechanicsParams }=require('./fit_controlled_mechanics.js');

const BASE='/Users/philipbernard/mimic-data/derived';
const PREFIT=BASE+'/primary60_conservative_prefit.json';
const REFIT=BASE+'/primary60_ps_fio2_composite_refit.jsonl';
const OUT=BASE+'/acid_base_joint_smoke_4.json';

const IDS=[
  'FIT-05c54056e1c9',
  'FIT-37d46fb4de8b',
  'FIT-66b775dbbe1f',
  'FIT-102b833418f3',
];
const CO2=[0.10,0.25,0.40,0.55,0.70,0.82];
const VPF=[0.50,0.60,0.70,0.80,0.85,0.90,0.95,1.00];

function loadJsonl(p){
  return fs.readFileSync(p,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
}
function sq(x){return x*x;}
const prefit=new Map(JSON.parse(fs.readFileSync(PREFIT,'utf8')).map(x=>[x.event_id,x]));
const prior=new Map(loadJsonl(REFIT).map(x=>[x.event_id,x]));

function sessionFor(e,{sid,co2=0.40,vpf=0.85}){
  const p=e.prefit,v=e.vent;
  return createBerlinLiveHumModSession({
    caseId:LIVE_HUMMOD_REFERENCE_CASE_ID,
    ventilation:{
      mode:'PS',fio2:v.fio2_percent/100,peep:v.peep,rr:2,
      pressureSupportCmH2O:v.psv,
    },
    initialRecruitmentState:{normal:1,recruitable:0.35,consolidated:0},
    patientStateProfile:'awake_cooperative',
    patientDriveRelativeOverride:p.drive,
    patientMuscleTransmissionOverride:p.muscle_transmission,
    patientMechanicsParams:mechanicsParams(p.stiffness_scale,p.resistance_scale),
    patientDeadSpaceFractionOfTidalVolume:co2,
    patientVentilatedPerfusionFractionOverride:vpf,
    patientBloodSidMolPerL:sid,
    patientArterialGasInitialization:{
      po2MmHg:e.targets.po2,pco2MmHg:e.targets.pco2,pH:e.targets.ph,
    },
    dt:0.010,mechanicalWarmupSec:8,coupledEquilibrationSec:0,
    physicianValidationCandidate:false,
  });
}

function initializedPH(e,sid){
  const s=sessionFor(e,{sid});
  const x=s.initialize();
  return x.coupling.patientGasInitializationDiagnostics.initializedPH;
}

function fitSid(e){
  let lo=0.005,hi=0.100;
  const target=e.targets.ph;
  const plo=initializedPH(e,lo),phi=initializedPH(e,hi);
  const increasing=phi>plo;
  if(target<Math.min(plo,phi)||target>Math.max(plo,phi)){
    return null;
  }
  let best=null;
  for(let i=0;i<36;i++){
    const mid=(lo+hi)/2,ph=initializedPH(e,mid),err=ph-target;
    if(!best||Math.abs(err)<Math.abs(best.error)) best={sid:mid,initializedPH:ph,error:err};
    if(Math.abs(err)<1e-6) break;
    if(increasing){ if(ph<target) lo=mid; else hi=mid; }
    else { if(ph>target) lo=mid; else hi=mid; }
  }
  return best;
}

function run(e,pars,totalSec){
  const s=sessionFor(e,pars);
  s.initialize();
  const baseline=s.runFor(24);
  let elapsed=24;
  while(elapsed<totalSec){
    const step=Math.min(30,totalSec-elapsed);
    s.runFor(step); s.compactTraceHistory(60); elapsed+=step;
  }
  const final=s.snapshot();
  return {
    baseline:{
      po2:baseline.systemic.gasExchange.pao2MmHg,
      pco2:baseline.systemic.gasExchange.paco2MmHg,
      pH:baseline.systemic.gasExchange.pH,
    },
    final:{
      po2:final.systemic.gasExchange.pao2MmHg,
      pco2:final.systemic.gasExchange.paco2MmHg,
      pH:final.systemic.gasExchange.pH,
    }
  };
}

const out=[];
for(const id of IDS){
  const e=prefit.get(id),old=prior.get(id);
  if(!e||!old){out.push({event_id:id,status:'missing-input'});continue;}
  const sidFit=fitSid(e);
  if(!sidFit){out.push({event_id:id,status:'sid-fit-failed'});continue;}

  let bestCo2=null;
  for(const co2 of CO2){
    try{
      const r=run(e,{sid:sidFit.sid,co2,vpf:0.85},900);
      const score=sq((r.baseline.pco2-e.targets.pco2)/8)+
                  sq((r.final.pco2-e.targets.pco2)/8)+
                  sq((r.baseline.pH-e.targets.ph)/0.10);
      if(!bestCo2||score<bestCo2.score) bestCo2={co2,score,r};
    }catch(_){}
  }
  if(!bestCo2){out.push({event_id:id,status:'co2-refit-failed'});continue;}

  let bestVpf=null;
  for(const vpf of VPF){
    try{
      const r=run(e,{sid:sidFit.sid,co2:bestCo2.co2,vpf},900);
      const score=sq((r.baseline.po2-e.targets.po2)/20)+
                  sq((r.final.po2-e.targets.po2)/20);
      if(!bestVpf||score<bestVpf.score) bestVpf={vpf,score,r};
    }catch(_){}
  }
  if(!bestVpf){out.push({event_id:id,status:'vpf-refit-failed'});continue;}

  const c=run(e,{sid:sidFit.sid,co2:bestCo2.co2,vpf:bestVpf.vpf},3600);
  const residuals={
    baseline_pco2:c.baseline.pco2-e.targets.pco2,
    baseline_po2:c.baseline.po2-e.targets.po2,
    baseline_ph:c.baseline.pH-e.targets.ph,
    drift_pco2_60:c.final.pco2-c.baseline.pco2,
    drift_po2_60:c.final.po2-c.baseline.po2,
    drift_ph_60:c.final.pH-c.baseline.pH,
  };
  const pass=Math.abs(residuals.baseline_pco2)<=8 &&
    Math.abs(residuals.baseline_po2)<=20 &&
    Math.abs(residuals.drift_pco2_60)<=8 &&
    Math.abs(residuals.drift_po2_60)<=20;

  const row={
    event_id:id,status:'joint-fit-complete',
    previous_pass:old.pass,new_pass:pass,
    measured:{pH:e.targets.ph,pco2:e.targets.pco2,po2:e.targets.po2},
    fitted:{
      latent_sid_mol_per_l:sidFit.sid,
      effective_co2_elimination_fraction:bestCo2.co2,
      effective_ventilated_perfusion_fraction:bestVpf.vpf,
    },
    residuals,
    provenance:{
      post_index_data_loaded:false,
      sid_interpretation:'latent-model-acid-base-state-not-direct-clinical-SID',
      sid_fit_target:'pretransition-measured-pH-at-measured-PaCO2-PaO2',
      co2_and_vpf_refit_after_sid:true,
    }
  };
  out.push(row);
  console.log(JSON.stringify(row));
}
fs.writeFileSync(OUT,JSON.stringify(out,null,2)+'\n');
console.log('wrote',OUT,out.length);
