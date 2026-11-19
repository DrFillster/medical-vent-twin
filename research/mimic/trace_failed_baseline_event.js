'use strict';
const fs=require('fs');
const {LIVE_HUMMOD_REFERENCE_CASE_ID,createBerlinLiveHumModSession}=
  require('../../ards-twin-v1.0/src/clinical_twin_live_hummod_session.js');
const {mechanicsParams}=require('./fit_controlled_mechanics.js');

const INPUT='/Users/philipbernard/mimic-data/derived/controlled_blinded_fit_ready.json';
const OUT='/Users/philipbernard/mimic-data/derived/fit_11e9d_nochange_trajectory.json';
const e=JSON.parse(fs.readFileSync(INPUT,'utf8')).find(x=>x.event_id==='FIT-11e9d251e800');
if(!e) throw new Error('event not found');
const m=e.mechanics_fit;

const s=createBerlinLiveHumModSession({
  caseId:LIVE_HUMMOD_REFERENCE_CASE_ID,
  ventilation:{
    mode:'PC_AC',fio2:e.pre_fio2/100,peep:e.pre_peep,rr:e.pre_rr_set,
    pinspCmH2O:e.pre_pinsp,inspiratoryTimeSec:e.pre_inspiratory_time_sec,
    inspiratoryPauseSec:0,
  },
  initialRecruitmentState:{
    normal:1,recruitable:m.initialRecruitmentStateRecruitable,consolidated:0
  },
  patientMechanicsParams:mechanicsParams(m.stiffnessScale,m.resistanceScale),
  patientArterialGasInitialization:{
    po2MmHg:e.pre_po2,pco2MmHg:e.pre_pco2,pH:e.pre_ph
  },
  patientDeadSpaceFractionOfTidalVolume:0.70,
  patientVentilatedPerfusionFractionOverride:1.0,
  patientTissueCo2ProductionMmolPerMin:7,
  dt:0.002,
  mechanicalWarmupSec:Math.max(3,2.5*(60/e.pre_rr_set)),
  coupledEquilibrationSec:0,
  physicianValidationCandidate:false,
});
s.initialize();

const horizons=[60,120,300,600,900,1200,1680];
const trajectory=[];
let elapsed=0;
for(const h of horizons){
  const snap=s.runFor(h-elapsed);
  elapsed=h;
  const g=snap.systemic.gasExchange;
  trajectory.push({
    sec:h,pao2:g.pao2MmHg,paco2:g.paco2MmHg,pH:g.pH,
    vpf:g.ventilatedPerfusionFraction
  });
}
const out={
  event_id:e.event_id,
  observed_pre:{pao2:e.pre_po2,paco2:e.pre_pco2,pH:e.pre_ph},
  frozen:{deadspace:0.70,vpf:1.0,co2Production:7},
  trajectory,truth_file_read:false
};
fs.writeFileSync(OUT,JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out));
