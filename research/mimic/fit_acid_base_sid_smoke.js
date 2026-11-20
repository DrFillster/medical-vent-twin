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
const OUT=BASE+'/acid_base_sid_smoke_4.json';

const IDS=[
  'FIT-05c54056e1c9',
  'FIT-37d46fb4de8b',
  'FIT-66b775dbbe1f',
  'FIT-102b833418f3',
];

function loadJsonl(p){
  return fs.readFileSync(p,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
}
const prefit=new Map(JSON.parse(fs.readFileSync(PREFIT,'utf8')).map(x=>[x.event_id,x]));
const refit=new Map(loadJsonl(REFIT).map(x=>[x.event_id,x]));

function makeSession(e,r,sid){
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
    patientDeadSpaceFractionOfTidalVolume:
      r.fitted.effective_co2_elimination_fraction,
    patientVentilatedPerfusionFractionOverride:
      r.fitted.effective_ventilated_perfusion_fraction,
    patientBloodSidMolPerL:sid,
    patientArterialGasInitialization:{
      po2MmHg:e.targets.po2,
      pco2MmHg:e.targets.pco2,
      pH:e.targets.ph,
    },
    dt:0.010,
    mechanicalWarmupSec:8,
    coupledEquilibrationSec:0,
    physicianValidationCandidate:false,
  });
}

function initializedPH(e,r,sid){
  const s=makeSession(e,r,sid);
  const x=s.initialize();
  return x.coupling.patientGasInitializationDiagnostics.initializedPH;
}

function fitSidToPH(e,r){
  // Computational model-search envelope only. These are not claimed
  // physiologic SID reference limits.
  let lo=0.005,hi=0.100;
  const target=e.targets.ph;
  let plo=initializedPH(e,r,lo);
  let phi=initializedPH(e,r,hi);

  if(!Number.isFinite(plo)||!Number.isFinite(phi)){
    throw new Error('non-finite SID search endpoints');
  }
  const increasing=phi>plo;
  const minPH=Math.min(plo,phi),maxPH=Math.max(plo,phi);
  if(target<minPH || target>maxPH){
    return {
      status:'target-outside-computational-envelope',
      sid:null,
      targetPH:target,
      endpointPH:{lo:plo,hi:phi},
    };
  }

  let best=null;
  for(let i=0;i<36;i++){
    const mid=(lo+hi)/2;
    const ph=initializedPH(e,r,mid);
    const err=ph-target;
    if(!best || Math.abs(err)<Math.abs(best.error)){
      best={sid:mid,initializedPH:ph,error:err};
    }
    if(Math.abs(err)<1e-6) break;
    if(increasing){
      if(ph<target) lo=mid; else hi=mid;
    } else {
      if(ph>target) lo=mid; else hi=mid;
    }
  }
  return {status:'fit',...best,targetPH:target};
}

function stationarity(e,r,sid){
  const s=makeSession(e,r,sid);
  s.initialize();
  const baseline=s.runFor(24);
  let elapsed=24;
  while(elapsed<3600){
    const step=Math.min(30,3600-elapsed);
    s.runFor(step);
    s.compactTraceHistory(60);
    elapsed+=step;
  }
  const final=s.snapshot();
  const bg=baseline.systemic.gasExchange;
  const fg=final.systemic.gasExchange;
  const residuals={
    baseline_pco2:bg.paco2MmHg-e.targets.pco2,
    baseline_po2:bg.pao2MmHg-e.targets.po2,
    baseline_ph:bg.pH-e.targets.ph,
    drift_pco2_60:fg.paco2MmHg-bg.paco2MmHg,
    drift_po2_60:fg.pao2MmHg-bg.pao2MmHg,
    drift_ph_60:fg.pH-bg.pH,
  };
  const pass=Math.abs(residuals.baseline_pco2)<=8 &&
    Math.abs(residuals.baseline_po2)<=20 &&
    Math.abs(residuals.drift_pco2_60)<=8 &&
    Math.abs(residuals.drift_po2_60)<=20;
  return {pass,residuals,
    baseline:{pao2:bg.pao2MmHg,paco2:bg.paco2MmHg,pH:bg.pH},
    final:{pao2:fg.pao2MmHg,paco2:fg.paco2MmHg,pH:fg.pH}};
}

const out=[];
for(const id of IDS){
  const e=prefit.get(id),r=refit.get(id);
  if(!e||!r||r.status!=='fit-complete'){
    out.push({event_id:id,status:'missing-input'});
    continue;
  }
  const fit=fitSidToPH(e,r);
  if(fit.status!=='fit'){
    out.push({event_id:id,status:fit.status,fit});
    continue;
  }
  const st=stationarity(e,r,fit.sid);
  const row={
    event_id:id,
    previous_pass:r.pass,
    measured:{pH:e.targets.ph,pco2:e.targets.pco2,po2:e.targets.po2,
      base_excess:e.targets.base_excess??null},
    frozen:{
      co2_elimination_fraction:r.fitted.effective_co2_elimination_fraction,
      ventilated_perfusion_fraction:r.fitted.effective_ventilated_perfusion_fraction,
      drive:e.prefit.drive,
      muscle_transmission:e.prefit.muscle_transmission,
      stiffness_scale:e.prefit.stiffness_scale,
      resistance_scale:e.prefit.resistance_scale,
    },
    sid_fit:fit,
    stationarity:st,
    provenance:{
      post_index_data_loaded:false,
      sid_interpretation:'latent-model-acid-base-state-not-direct-clinical-SID',
      sid_search_envelope:'computational-only-0.005-to-0.100-mol-per-L',
      only_new_parameter:'patientBloodSidMolPerL',
    }
  };
  out.push(row);
  console.log(JSON.stringify({
    event_id:id,
    previousPass:r.pass,
    fittedSid:fit.sid,
    initPhError:fit.error,
    newPass:st.pass,
    residuals:st.residuals,
  }));
}
fs.writeFileSync(OUT,JSON.stringify(out,null,2)+'\n');
console.log('wrote',OUT,out.length);
