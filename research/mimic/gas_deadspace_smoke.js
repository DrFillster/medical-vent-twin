'use strict';

const fs=require('fs');
const {
  LIVE_HUMMOD_REFERENCE_CASE_ID,
  createBerlinLiveHumModSession,
}=require('../../ards-twin-v1.0/src/clinical_twin_live_hummod_session.js');
const { mechanicsParams }=require('./fit_controlled_mechanics.js');

const INPUT='/Users/philipbernard/mimic-data/derived/controlled_fit_inputs.jsonl';
const MECH='/Users/philipbernard/mimic-data/derived/controlled_mechanics_fit.jsonl';
const OUT='/Users/philipbernard/mimic-data/derived/gas_deadspace_smoke_5.json';

const inputs=new Map(
  fs.readFileSync(INPUT,'utf8').trim().split('\n').filter(Boolean)
    .map(x=>JSON.parse(x)).map(x=>[x.event_id,x])
);
const fits=fs.readFileSync(MECH,'utf8').trim().split('\n').filter(Boolean)
  .map(x=>JSON.parse(x))
  .filter(x=>x.best && Number.isFinite(x.best.objective) && x.best.objective<=1.0)
  .slice(0,5);

function ventFor(e){
  const v=e.vent;
  if(e.hummod_mode==='VC_AC'){
    return {
      mode:'VC_AC',fio2:v.fio2_percent/100,peep:v.peep,rr:v.rr_set,
      vtL:v.vt_set_ml/1000,inspiratoryFlowLps:v.flow_lps,
      inspiratoryPauseSec:0,
    };
  }
  return {
    mode:'PC_AC',fio2:v.fio2_percent/100,peep:v.peep,rr:v.rr_set,
    pinspCmH2O:v.pinsp,inspiratoryTimeSec:v.inspiratory_time_sec,
    inspiratoryPauseSec:0,
  };
}

const fractions=[0.20,0.35,0.50,0.65];
const results=[];

for(const fit of fits){
  const e=inputs.get(fit.event_id);
  if(!e) continue;
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
        initialRecruitmentState:{
          normal:1,recruitable:initRecruitment,consolidated:0
        },
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
      const pco2Error=g.paco2MmHg-e.targets.pco2;
      const objective=Math.pow(
        pco2Error/Math.max(5,0.10*e.targets.pco2),2
      );
      const row={
        fraction,objective,
        finalPco2:g.paco2MmHg,pco2Error,
        finalPH:g.pH,phError:g.pH-e.targets.ph,
        finalPo2:g.pao2MmHg,po2Error:g.pao2MmHg-e.targets.po2,
      };
      candidates.push(row);
      if(!best || objective<best.objective) best=row;
    }catch(err){
      candidates.push({fraction,error:String(err.message||err)});
    }
  }
  results.push({
    event_id:e.event_id,mode:e.hummod_mode,
    target:{pco2:e.targets.pco2,pH:e.targets.ph,po2:e.targets.po2},
    mechanicsObjective:fit.best.objective,
    best,candidates,
    fittingTarget:'PaCO2 maintenance only',
    diagnostics:['pH','PaO2'],
    durationSec:20,
  });
  console.log(JSON.stringify({
    event_id:e.event_id,mode:e.hummod_mode,
    mechanicsObjective:fit.best.objective,
    bestFraction:best&&best.fraction,
    pco2Error:best&&best.pco2Error,
    phError:best&&best.phError,
    po2Error:best&&best.po2Error
  }));
}
fs.writeFileSync(OUT,JSON.stringify(results,null,2)+'\n');
