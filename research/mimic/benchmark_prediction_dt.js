'use strict';

const fs=require('fs');
const {performance}=require('perf_hooks');
const {
  LIVE_HUMMOD_REFERENCE_CASE_ID,
  createBerlinLiveHumModSession,
}=require('../../ards-twin-v1.0/src/clinical_twin_live_hummod_session.js');
const { mechanicsParams }=require('./fit_controlled_mechanics.js');

const frozen=JSON.parse(fs.readFileSync(
  '/Users/philipbernard/mimic-data/derived/frozen_ps_phenotypes_6.json','utf8'));
const benchmarkEventId=process.env.BENCH_EVENT || 'FIT-3262c4e214cf';
const x=frozen.find(r=>r.event_id===benchmarkEventId);
if(!x) throw new Error('benchmark event not found');

function run(dt){
  const s=createBerlinLiveHumModSession({
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
    dt,
    mechanicalWarmupSec:3,
    coupledEquilibrationSec:0,
  });
  s.initialize();
  const isFio2=x.intervention.itemid===223835;
  const isPeep=x.intervention.itemid===220339;
  if(!isFio2 && !isPeep) throw new Error('benchmark intervention unsupported');
  const v={
    mode:'PS',
    fio2:isFio2 ? x.intervention.post_value/100 : x.ventilator_pre.fio2_percent/100,
    peep:isPeep ? x.intervention.post_value : x.ventilator_pre.peep,
    rr:2,
    pressureSupportCmH2O:x.ventilator_pre.psv,
  };
  s.requestVentilationChange(v);
  const t0=performance.now();
  const snap=s.runFor(120);
  const wall=(performance.now()-t0)/1000;
  const b=snap.pulmonary.measurements.lastCompletedBreath;
  return {
    dt,wallSec:wall,
    pao2:snap.systemic.gasExchange.pao2MmHg,
    paco2:snap.systemic.gasExchange.paco2MmHg,
    ph:snap.systemic.gasExchange.pH,
    hr:snap.systemic.hemodynamics.heartRatePerMin,
    map:snap.systemic.hemodynamics.meanArterialPressureMmHg,
    rr:b?b.RR:null,
    vtMl:b?b.VtInspired*1000:null,
    mv:b?b.MV:null,
  };
}

const out=[0.002,0.005,0.010].map(run);
console.log(JSON.stringify(out,null,2));
fs.writeFileSync('/Users/philipbernard/mimic-data/derived/dt_benchmark_ps.json',
  JSON.stringify(out,null,2)+'\n');
