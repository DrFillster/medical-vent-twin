'use strict';

const fs=require('fs');
const {performance}=require('perf_hooks');
const {
  LIVE_HUMMOD_REFERENCE_CASE_ID,
  createBerlinLiveHumModSession,
}=require('../../ards-twin-v1.0/src/clinical_twin_live_hummod_session.js');
const { mechanicsParams }=require('./fit_controlled_mechanics.js');

const DER='/Users/philipbernard/mimic-data/derived';
const frozen=JSON.parse(fs.readFileSync(DER+'/frozen_ps_phenotypes_6.json','utf8'));
const horizons=JSON.parse(fs.readFileSync(DER+'/ps_prediction_horizons_clean_5.json','utf8'));
const hmap=new Map(horizons.map(x=>[x.event_id,x]));
const clean=frozen.filter(x=>hmap.has(x.event_id));

const idx=process.env.EVENT_INDEX==null?null:Number(process.env.EVENT_INDEX);
const selected=idx==null?clean:[clean[idx]];
const results=[];

function buildSession(x){
  return createBerlinLiveHumModSession({
    caseId:LIVE_HUMMOD_REFERENCE_CASE_ID,
    ventilation:{
      mode:'PS',
      fio2:x.ventilator_pre.fio2_percent/100,
      peep:x.ventilator_pre.peep,
      rr:2,
      pressureSupportCmH2O:x.ventilator_pre.psv,
    },
    initialRecruitmentState:{normal:1,recruitable:0.35,consolidated:0},
    patientStateProfile:'awake_cooperative',
    patientDriveRelativeOverride:x.effort.hennigs_drive_relative,
    patientMuscleTransmissionOverride:x.effort.muscle_transmission_relative,
    patientMechanicsParams:mechanicsParams(x.effort.stiffness_scale,1.0),
    patientDeadSpaceFractionOfTidalVolume:x.dead_space.fraction,
    patientVentilatedPerfusionFractionOverride:
      x.oxygenation.effective_ventilated_perfusion_fraction,
    patientArterialGasInitialization:{
      po2MmHg:x.arterial_gas_initialization.po2_mmHg,
      pco2MmHg:x.arterial_gas_initialization.pco2_mmHg,
      pH:x.arterial_gas_initialization.ph_measured,
    },
    dt:0.010,
    mechanicalWarmupSec:3,
    coupledEquilibrationSec:20,
    physicianValidationCandidate:false,
  });
}

function interventionVent(x){
  const isFio2=x.intervention.itemid===223835;
  const isPeep=x.intervention.itemid===220339;
  if(!isFio2 && !isPeep) throw new Error('unsupported intervention itemid');
  return {
    mode:'PS',
    fio2:isFio2
      ? x.intervention.post_value/100
      : x.ventilator_pre.fio2_percent/100,
    peep:isPeep
      ? x.intervention.post_value
      : x.ventilator_pre.peep,
    rr:2,
    pressureSupportCmH2O:x.ventilator_pre.psv,
  };
}

for(const x of selected){
  const h=hmap.get(x.event_id);
  const totalSec=Math.round(h.post_abg_minutes*60);
  const t0=performance.now();
  try{
    const s=buildSession(x);
    const baseline=s.initialize();
    const baselineGas={
      pao2:baseline.systemic.gasExchange.pao2MmHg,
      paco2:baseline.systemic.gasExchange.paco2MmHg,
      ph:baseline.systemic.gasExchange.pH
    };
    s.requestVentilationChange(interventionVent(x));

    let remaining=totalSec;
    while(remaining>0){
      const step=Math.min(60,remaining);
      s.runFor(step);
      s.compactTraceHistory(75);
      remaining-=step;
    }

    const snap=s.runFor(0);
    const b=snap.pulmonary.measurements.lastCompletedBreath;
    const result={
      event_id:x.event_id,
      phenotype_schema_version:x.phenotype_schema_version,
      code_commit:x.code_commit,
      simulation_dt_sec:0.010,
      baseline_equilibration_sec:20,
      prediction_horizon_minutes:h.post_abg_minutes,
      intervention:x.intervention,
      baseline_after_equilibration:baselineGas,
      predicted:{
        pao2:snap.systemic.gasExchange.pao2MmHg,
        paco2:snap.systemic.gasExchange.paco2MmHg,
        ph:snap.systemic.gasExchange.pH,
        hr:snap.systemic.hemodynamics.heartRatePerMin,
        map:snap.systemic.hemodynamics.meanArterialPressureMmHg,
        rr:b?b.RR:null,
        vt_ml:b?b.VtInspired*1000:null,
        minute_volume:b?b.MV:null
      },
      wall_sec:(performance.now()-t0)/1000,
      status:'completed'
    };
    results.push(result);
    console.log(JSON.stringify({
      event_id:x.event_id,
      horizon_min:h.post_abg_minutes,
      pao2:result.predicted.pao2,
      paco2:result.predicted.paco2,
      hr:result.predicted.hr,
      map:result.predicted.map,
      wall_sec:result.wall_sec
    }));
  }catch(err){
    const result={
      event_id:x.event_id,
      prediction_horizon_minutes:h.post_abg_minutes,
      status:'failed',
      error:String(err.message||err),
      wall_sec:(performance.now()-t0)/1000
    };
    results.push(result);
    console.log(JSON.stringify(result));
  }
}

const suffix=idx==null?'all':String(idx);
fs.writeFileSync(DER+'/ps_blinded_predictions_'+suffix+'.json',
  JSON.stringify(results,null,2)+'\n');
