'use strict';
const fs=require('fs');
const {LIVE_HUMMOD_REFERENCE_CASE_ID,createBerlinLiveHumModSession}=
  require('../../ards-twin-v1.0/src/clinical_twin_live_hummod_session.js');
const {mechanicsParams}=require('./fit_controlled_mechanics.js');

const INPUT='/Users/philipbernard/mimic-data/derived/controlled_blinded_fit_ready.json';
const e=JSON.parse(fs.readFileSync(INPUT,'utf8')).find(x=>x.event_id==='FIT-11e9d251e800');
const m=e.mechanics_fit;
const s=createBerlinLiveHumModSession({
  caseId:LIVE_HUMMOD_REFERENCE_CASE_ID,
  ventilation:{mode:'PC_AC',fio2:e.pre_fio2/100,peep:e.pre_peep,rr:e.pre_rr_set,
    pinspCmH2O:e.pre_pinsp,inspiratoryTimeSec:e.pre_inspiratory_time_sec,inspiratoryPauseSec:0},
  initialRecruitmentState:{normal:1,recruitable:m.initialRecruitmentStateRecruitable,consolidated:0},
  patientMechanicsParams:mechanicsParams(m.stiffnessScale,m.resistanceScale),
  patientArterialGasInitialization:{po2MmHg:e.pre_po2,pco2MmHg:e.pre_pco2,pH:e.pre_ph},
  patientDeadSpaceFractionOfTidalVolume:0.70,
  patientVentilatedPerfusionFractionOverride:1.0,
  patientTissueCo2ProductionMmolPerMin:7,
  dt:0.002,mechanicalWarmupSec:Math.max(3,2.5*(60/e.pre_rr_set)),
  coupledEquilibrationSec:0,physicianValidationCandidate:false,
});
function snap(tag,x){
  const g=x.systemic.gasExchange;
  const h=x.systemic.hemodynamics;
  const b=x.pulmonary.measurements.lastCompletedBreath;
  return {
    tag,
    gas:{pao2:g.pao2MmHg,paco2:g.paco2MmHg,pH:g.pH,
      pvo2:g.pvo2MmHg,svo2:g.svo2Fraction,
      alveolarPo2:g.alveolarPo2MmHg,
      endCapillaryPo2:g.endCapillaryPo2MmHg,
      totalShunt:g.totalShuntMlPerMin,
      vpf:g.ventilatedPerfusionFraction,
      o2Use:g.actualTissueO2UseMlPerMin},
    hemo:{hr:h.heartRatePerMin,map:h.meanArterialPressureMmHg,
      co:h.cardiacOutputMlPerMin},
    breath:b?{rr:b.RR,vtMl:b.VtInspired*1000,mv:b.MV,peak:b.Ppeak}:null
  };
}
const out=[];
out.push(snap('init',s.initialize()));
let elapsed=0;
for(const sec of [60,120,300]){
  const x=s.runFor(sec-elapsed); elapsed=sec; out.push(snap(sec+'s',x));
}
console.log(JSON.stringify({event_id:e.event_id,observed:{vt:e.pre_vt_observed,rr:e.pre_rr_set,mv:e.pre_minute_volume},out},null,2));
