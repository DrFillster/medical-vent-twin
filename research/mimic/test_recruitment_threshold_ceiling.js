'use strict';

const fs=require('fs');
const {
  LIVE_HUMMOD_REFERENCE_CASE_ID,
  createBerlinLiveHumModSession,
}=require('../../ards-twin-v1.0/src/clinical_twin_live_hummod_session.js');
const {getBerlinCase}=require('../../ards-twin-v1.0/src/berlin_case_catalog.js');

const BASE='/Users/philipbernard/mimic-data/derived';
function load(p){return fs.readFileSync(p,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);}
function clone(x){return JSON.parse(JSON.stringify(x));}
function mechanicsParams(f,pclose){
  const c=getBerlinCase(LIVE_HUMMOD_REFERENCE_CASE_ID);
  const p=clone(c.phenotype.mechanicsParams);
  for(const comp of p.compartments) comp.elasticScale*=f.stiffness_scale;
  p.centralAirwayResistance=f.central_airway_resistance;
  const q=0.02, rem=1-q;
  for(const comp of p.compartments){
    if(comp.id==='normal') comp.perfusionFraction=rem*(55/85);
    else if(comp.id==='recruitable'){
      comp.perfusionFraction=rem*(30/85);
      comp.recruitment={...comp.recruitment,P_close:pclose,P_open:pclose+10};
    }
    else if(comp.id==='consolidated') comp.perfusionFraction=q;
  }
  return p;
}
const inputs=new Map(load(BASE+'/ps_fit_inputs.jsonl').map(x=>[x.event_id,x]));
const pc=[0,2,5,8,12];
for(let i=0;i<5;i++){
  const refit=JSON.parse(fs.readFileSync(BASE+'/freeze3_stationary_recruit_dev'+i+'.jsonl','utf8').trim());
  const input=inputs.get(refit.event_id), f=refit.fitted, v=input.vent;
  const vals=[];
  for(const pclose of pc){
    try{
      const s=createBerlinLiveHumModSession({
        caseId:LIVE_HUMMOD_REFERENCE_CASE_ID,
        ventilation:{mode:'PS',fio2:v.fio2_percent/100,peep:v.peep,rr:v.backup_rate_prior,pressureSupportCmH2O:v.pressure_support},
        initialRecruitmentState:{normal:1,recruitable:1,consolidated:0},
        patientStateProfile:f.effort_profile,
        patientDriveRelativeOverride:f.hennigs_drive_relative,
        patientMechanicsParams:mechanicsParams(f,pclose),
        patientDeadSpaceFractionOfTidalVolume:f.dead_space_fraction_of_vt,
        patientArterialGasInitialization:{po2MmHg:input.targets.po2,pco2MmHg:input.targets.pco2,pH:input.targets.ph},
        dt:0.01,mechanicalWarmupSec:8,coupledEquilibrationSec:0,physicianValidationCandidate:false
      });
      s.initialize(); s.runFor(24);
      let elapsed=24; while(elapsed<900){const step=Math.min(30,900-elapsed);s.runFor(step);s.compactTraceHistory(60);elapsed+=step;}
      const x=s.snapshot(),g=x.systemic.gasExchange;
      vals.push({pclose,popen:pclose+10,pao2:g.pao2MmHg,paco2:g.paco2MmHg,
        ventilatedPerfusionFraction:g.ventilatedPerfusionFraction,totalShuntMlPerMin:g.totalShuntMlPerMin});
    }catch(e){vals.push({pclose,error:e.message});}
  }
  console.log(JSON.stringify({event_id:refit.event_id,target_pao2:input.targets.po2,target_pco2:input.targets.pco2,results:vals}));
}
