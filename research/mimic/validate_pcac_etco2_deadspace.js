'use strict';

const fs=require('fs');
const {
  LIVE_HUMMOD_REFERENCE_CASE_ID,
  createBerlinLiveHumModSession,
}=require('../../ards-twin-v1.0/src/clinical_twin_live_hummod_session.js');
const { mechanicsParams }=require('./fit_controlled_mechanics.js');

const INPUT='/Users/philipbernard/mimic-data/derived/controlled_fit_inputs.jsonl';
const MECH='/Users/philipbernard/mimic-data/derived/controlled_mechanics_fit.jsonl';
const OUT='/Users/philipbernard/mimic-data/derived/pcac_etco2_deadspace_validation.json';
const MAP='/Users/philipbernard/mimic-data/derived/pcac_etco2_targets.json';

const inputs=new Map(
  fs.readFileSync(INPUT,'utf8').trim().split('\n').filter(Boolean)
    .map(JSON.parse).map(x=>[x.event_id,x])
);
const fits=new Map(
  fs.readFileSync(MECH,'utf8').trim().split('\n').filter(Boolean)
    .map(JSON.parse).map(x=>[x.event_id,x])
);
const targets=JSON.parse(fs.readFileSync(MAP,'utf8'));

function ventFor(e){
  const v=e.vent;
  return {
    mode:'PC_AC',fio2:v.fio2_percent/100,peep:v.peep,rr:v.rr_set,
    pinspCmH2O:v.pinsp,inspiratoryTimeSec:v.inspiratory_time_sec,
    inspiratoryPauseSec:0,
  };
}

const fractions=[0.10,0.20,0.30,0.40,0.50,0.60,0.70,0.80];
const results=[];

for(const t of targets){
  const e=inputs.get(t.event_id);
  const fit=fits.get(t.event_id);
  if(!e || !fit || !fit.best || !Number.isFinite(fit.best.objective)){
    results.push({...t,error:'missing usable controlled mechanics fit'});
    continue;
  }
  const initRecruitment=
    fit.best.initialRecruitmentStateRecruitable ??
    fit.best.recruitableFraction ?? 0.35;
  const patientMechanics=mechanicsParams(
    fit.best.stiffnessScale,fit.best.resistanceScale
  );
  let best=null;
  const candidates=[];
  for(const fraction of fractions){
    try{
      const session=createBerlinLiveHumModSession({
        caseId:LIVE_HUMMOD_REFERENCE_CASE_ID,
        ventilation:ventFor(e),
        initialRecruitmentState:{normal:1,recruitable:initRecruitment,consolidated:0},
        patientMechanicsParams:patientMechanics,
        patientDeadSpaceFractionOfTidalVolume:fraction,
        patientArterialGasInitialization:{
          po2MmHg:e.targets.po2,
          pco2MmHg:e.targets.pco2,
          pH:e.targets.ph,
        },
        dt:0.002,
        mechanicalWarmupSec:3,
        coupledEquilibrationSec:0,
      });
      session.initialize();
      const s=session.runFor(20);
      const g=s.systemic.gasExchange;
      const error=g.paco2MmHg-e.targets.pco2;
      const objective=Math.abs(error);
      const row={
        fraction,objective,pco2Error:error,
        finalPco2:g.paco2MmHg,finalPo2:g.pao2MmHg,finalPH:g.pH
      };
      candidates.push(row);
      if(!best || objective<best.objective) best=row;
    }catch(err){
      candidates.push({fraction,error:String(err.message||err)});
    }
  }
  results.push({
    ...t,mechanicsObjective:fit.best.objective,best,candidates
  });
  console.log(JSON.stringify({
    event_id:t.event_id,
    measuredGradient:t.measured_gradient,
    bestFraction:best&&best.fraction,
    pco2Error:best&&best.pco2Error,
    mechanicsObjective:fit.best.objective
  }));
}
fs.writeFileSync(OUT,JSON.stringify(results,null,2)+'\n');
