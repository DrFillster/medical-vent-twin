'use strict';

const fs=require('fs');
const {
  LIVE_HUMMOD_REFERENCE_CASE_ID,
  createBerlinLiveHumModSession,
}=require('../../ards-twin-v1.0/src/clinical_twin_live_hummod_session.js');
const {mechanicsParams}=require('./fit_controlled_mechanics.js');

const INPUT='/Users/philipbernard/mimic-data/derived/controlled_blinded_fit_ready.json';
const OUT='/Users/philipbernard/mimic-data/derived/controlled_forward_smoke_1.json';
const GAS_FIT='/Users/philipbernard/mimic-data/derived/baseline_gas_fit_smoke.json';
const HORIZON_SEC=Number(process.env.HORIZON_SEC??20);
if(!Number.isFinite(HORIZON_SEC) || HORIZON_SEC<=0){
  throw new Error('HORIZON_SEC must be finite and positive');
}

const rows=JSON.parse(fs.readFileSync(INPUT,'utf8'));
if(!rows.length) throw new Error('no controlled blinded fit-ready events');
const requestedEventId=process.env.EVENT_ID||null;
const e=requestedEventId ? rows.find(x=>x.event_id===requestedEventId) : rows[0];
if(!e) throw new Error('requested event not found');

function pctToFraction(v){
  if(v==null) return null;
  return v<=1 ? v : v/100;
}

function ventilationFor(event,after=false){
  const fio2 = after && event.intervention_type==='FIO2'
    ? pctToFraction(event.intervention_post_value)
    : pctToFraction(event.pre_fio2);
  const peep = after && event.intervention_type==='PEEP'
    ? event.intervention_post_value
    : event.pre_peep;

  if(event.hummod_mode==='PC_AC'){
    return {
      mode:'PC_AC',
      fio2,peep,
      rr:event.pre_rr_set,
      pinspCmH2O:event.pre_pinsp,
      inspiratoryTimeSec:event.pre_inspiratory_time_sec,
      inspiratoryPauseSec:0,
    };
  }
  if(event.hummod_mode==='VC_AC'){
    return {
      mode:'VC_AC',
      fio2,peep,
      rr:event.pre_rr_set,
      vtL:event.pre_vt_set/1000,
      inspiratoryFlowLps:event.pre_inspiratory_flow_lps,
      inspiratoryPauseSec:0,
    };
  }
  throw new Error('unsupported controlled mode '+event.hummod_mode);
}

function readMatchingGasFit(event, horizonSec){
  let fit;
  try {
    fit=JSON.parse(fs.readFileSync(GAS_FIT,'utf8'));
  } catch (cause) {
    throw new Error('Could not read or parse the saved baseline gas fit', {cause});
  }
  if(fit?.event_id!==event.event_id){
    throw new Error('Saved baseline gas fit event does not match selected event');
  }
  if(fit.fitHorizonSec!==horizonSec){
    throw new Error('Saved baseline gas fit horizon does not match HORIZON_SEC');
  }
  const deadspace=fit.bestDeadspace?.deadspace;
  const vpf=fit.bestVpf?.vpf;
  const co2Production=fit.bestTissueCo2Production?.co2Production;
  if(!Number.isFinite(deadspace) || deadspace<0 || deadspace>=1 ||
     !Number.isFinite(vpf) || vpf<0 || vpf>1 ||
     !Number.isFinite(co2Production) || co2Production<=0){
    throw new Error('Saved baseline gas fit contains invalid gas parameters');
  }
  return {
    patientDeadSpaceFractionOfTidalVolume:deadspace,
    patientVentilatedPerfusionFractionOverride:vpf,
    patientTissueCo2ProductionMmolPerMin:co2Production,
  };
}

function makeSession(event, gasParams){
  const m=event.mechanics_fit;
  return createBerlinLiveHumModSession({
    caseId:LIVE_HUMMOD_REFERENCE_CASE_ID,
    ventilation:ventilationFor(event,false),
    initialRecruitmentState:{
      normal:1,
      recruitable:m.initialRecruitmentStateRecruitable,
      consolidated:0,
    },
    patientMechanicsParams:mechanicsParams(
      m.stiffnessScale,m.resistanceScale
    ),
    patientArterialGasInitialization:{
      po2MmHg:event.pre_po2,
      pco2MmHg:event.pre_pco2,
      pH:event.pre_ph,
    },
    ...gasParams,
    dt:0.002,
    mechanicalWarmupSec:Math.max(3,2.5*(60/event.pre_rr_set)),
    coupledEquilibrationSec:0,
  });
}

// Independent baseline-stability probe; does not use truth.
const gasParams=readMatchingGasFit(e,HORIZON_SEC);
const baselineSession=makeSession(e,gasParams);
baselineSession.initialize();
const baseline=baselineSession.runFor(HORIZON_SEC);

// Fresh session for actual blinded intervention.
const predSession=makeSession(e,gasParams);
const initPred=predSession.initialize();
predSession.requestVentilationChange(ventilationFor(e,true));
const predicted=predSession.runFor(HORIZON_SEC);

function gases(s){
  const g=s.systemic.gasExchange;
  return {
    pao2:g.pao2MmHg,
    paco2:g.paco2MmHg,
    pH:g.pH,
    sao2Fraction:g.sao2Fraction,
    vpf:g.ventilatedPerfusionFraction,
    totalShuntMlPerMin:g.totalShuntMlPerMin,
  };
}
function mechanics(s){
  const b=s.pulmonary.measurements.lastValidDeliveredBreath;
  return b ? {
    rr:b.RR,
    vtMl:b.VtInspired*1000,
    mv:b.MV,
    peak:b.peakPressure,
    plateau:b.plateauPressure,
  } : null;
}

const out={
  event_id:e.event_id,
  mode:e.hummod_mode,
  intervention:{
    type:e.intervention_type,
    pre:e.intervention_pre_value,
    post:e.intervention_post_value,
    unit:e.intervention_unit,
  },
  mechanics_fit:e.mechanics_fit,
  observed_pre:{
    pH:e.pre_ph,paco2:e.pre_pco2,pao2:e.pre_po2,
    hr:e.pre_hr,map:e.pre_map,spo2:e.pre_spo2,
  },
  initialization:gases(initPred),
  no_intervention_at_horizon:{
    horizonSec:HORIZON_SEC,
    gases:gases(baseline),
    mechanics:mechanics(baseline),
  },
  blinded_prediction:{
    horizonSec:HORIZON_SEC,
    gases:gases(predicted),
    mechanics:mechanics(predicted),
  },
  truth_file_read:false,
  prediction_horizon_status:'technical-smoke-test-only-not-final-study-horizon',
};
fs.writeFileSync(OUT,JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out));
