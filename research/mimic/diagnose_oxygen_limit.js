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
function mechanicsParams(f){
  const c=getBerlinCase(LIVE_HUMMOD_REFERENCE_CASE_ID);
  const p=clone(c.phenotype.mechanicsParams);
  for(const comp of p.compartments) comp.elasticScale*=f.stiffness_scale;
  p.centralAirwayResistance=f.central_airway_resistance;
  const q=f.fixed_nonventilated_perfusion_fraction, rem=1-q;
  for(const comp of p.compartments){
    if(comp.id==='normal') comp.perfusionFraction=rem*(55/85);
    else if(comp.id==='recruitable') comp.perfusionFraction=rem*(30/85);
    else if(comp.id==='consolidated') comp.perfusionFraction=q;
  }
  return p;
}
const inputs=new Map(load(BASE+'/ps_fit_inputs.jsonl').map(x=>[x.event_id,x]));
for(let i=0;i<5;i++){
  const fit=JSON.parse(fs.readFileSync(BASE+'/freeze3_stationary_recruit_dev'+i+'.jsonl','utf8').trim());
  const input=inputs.get(fit.event_id);
  const f=fit.fitted, v=input.vent;
  const s=createBerlinLiveHumModSession({
    caseId:LIVE_HUMMOD_REFERENCE_CASE_ID,
    ventilation:{mode:'PS',fio2:v.fio2_percent/100,peep:v.peep,rr:v.backup_rate_prior,pressureSupportCmH2O:v.pressure_support},
    initialRecruitmentState:{normal:1,recruitable:f.baseline_recruitment_prior,consolidated:0},
    patientStateProfile:f.effort_profile,
    patientDriveRelativeOverride:f.hennigs_drive_relative,
    patientMechanicsParams:mechanicsParams(f),
    patientDeadSpaceFractionOfTidalVolume:f.dead_space_fraction_of_vt,
    patientArterialGasInitialization:{po2MmHg:input.targets.po2,pco2MmHg:input.targets.pco2,pH:input.targets.ph},
    dt:0.01,mechanicalWarmupSec:8,coupledEquilibrationSec:0,physicianValidationCandidate:false
  });
  s.initialize();
  const x=s.runFor(24);
  const g=x.systemic.gasExchange;
  const h=x.systemic.physicianComparison.liveHumMod;
  const b=x.pulmonary.measurements.lastValidDeliveredBreath||x.pulmonary.measurements.lastCompletedBreath;
  console.log(JSON.stringify({
    event_id:fit.event_id,
    target:{fio2:v.fio2_percent,po2:input.targets.po2,pco2:input.targets.pco2,spo2:input.targets.spo2},
    model:{
      pao2:g.pao2MmHg,paco2:g.paco2MmHg,pvo2:g.pvo2MmHg,svo2:g.svo2Fraction,
      requestedO2Use:g.requestedTissueO2UseMlPerMin,actualO2Use:g.actualTissueO2UseMlPerMin,
      oxygenDelivery:g.oxygenDeliveryMlPerMin,criticalOxygenDelivery:g.criticalOxygenDeliveryMlPerMin,
      deliveryToCritical:g.deliveryToCriticalRatio,extraction:g.actualExtractionRatio,
      alveolarPo2:g.alveolarPo2MmHg,endCapillaryPo2:g.endCapillaryPo2MmHg,
      oxygenUptake:g.oxygenUptakeMlPerMin,membraneGradient:g.membraneGradientMmHg,
      ventilatedPerfusionFraction:g.ventilatedPerfusionFraction,totalShuntMlPerMin:g.totalShuntMlPerMin,
      co:h.cardiacOutputMlPerMin,hr:h.heartRatePerMin,map:h.meanArterialPressureMmHg,
      vt:b&&b.VtInspired*1000,mv:b&&b.MV
    }
  }));
}
