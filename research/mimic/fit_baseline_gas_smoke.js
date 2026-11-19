'use strict';

const fs=require('fs');
const {
  LIVE_HUMMOD_REFERENCE_CASE_ID,
  createBerlinLiveHumModSession,
}=require('../../ards-twin-v1.0/src/clinical_twin_live_hummod_session.js');
const {mechanicsParams}=require('./fit_controlled_mechanics.js');

const INPUT='/Users/philipbernard/mimic-data/derived/controlled_blinded_fit_ready.json';
const OUT='/Users/philipbernard/mimic-data/derived/baseline_gas_fit_smoke.json';
const EVENT_ID=process.env.EVENT_ID||'FIT-b63aa85c9b17';
const FIT_HORIZON_SEC=Number(process.env.HORIZON_SEC||120);
const SEARCH_DT_SEC=Number(process.env.SEARCH_DT_SEC||0.005);
const CONFIRM_DT_SEC=Number(process.env.CONFIRM_DT_SEC||0.002);

const DEADSPACE=[0.10,0.20,0.30,0.40,0.50,0.60,0.70];
const VPF=[0.60,0.70,0.80,0.85,0.90,0.95,1.00];
const CO2_PRODUCTION=[3,4,5,6,7,8];

const rows=JSON.parse(fs.readFileSync(INPUT,'utf8'));
const e=rows.find(x=>x.event_id===EVENT_ID);
if(!e) throw new Error('event not found');

function pctToFraction(v){return v<=1?v:v/100;}
function ventilationFor(event){
  if(event.hummod_mode==='PC_AC'){
    return {
      mode:'PC_AC',fio2:pctToFraction(event.pre_fio2),peep:event.pre_peep,
      rr:event.pre_rr_set,pinspCmH2O:event.pre_pinsp,
      inspiratoryTimeSec:event.pre_inspiratory_time_sec,inspiratoryPauseSec:0,
    };
  }
  return {
    mode:'VC_AC',fio2:pctToFraction(event.pre_fio2),peep:event.pre_peep,
    rr:event.pre_rr_set,vtL:event.pre_vt_set/1000,
    inspiratoryFlowLps:event.pre_inspiratory_flow_lps,inspiratoryPauseSec:0,
  };
}
function makeSession({deadspace=null,vpf=null,co2Production=null,dtSec=SEARCH_DT_SEC}){
  const m=e.mechanics_fit;
  return createBerlinLiveHumModSession({
    caseId:LIVE_HUMMOD_REFERENCE_CASE_ID,
    ventilation:ventilationFor(e),
    initialRecruitmentState:{
      normal:1,
      recruitable:m.initialRecruitmentStateRecruitable,
      consolidated:0,
    },
    patientMechanicsParams:mechanicsParams(m.stiffnessScale,m.resistanceScale),
    patientArterialGasInitialization:{
      po2MmHg:e.pre_po2,pco2MmHg:e.pre_pco2,pH:e.pre_ph,
    },
    ...(deadspace==null?{}:{patientDeadSpaceFractionOfTidalVolume:deadspace}),
    ...(vpf==null?{}:{patientVentilatedPerfusionFractionOverride:vpf}),
    ...(co2Production==null?{}:{patientTissueCo2ProductionMmolPerMin:co2Production}),
    dt:dtSec,
    mechanicalWarmupSec:Math.max(3,2.5*(60/e.pre_rr_set)),
    coupledEquilibrationSec:0,
  });
}

// Stage 1: PaCO2 maintenance.
let bestDeadspace=null;
const deadspaceRows=[];
for(const deadspace of DEADSPACE){
  try{
    const s=makeSession({deadspace,vpf:0.95});
    s.initialize();
    const x=s.runFor(10);
    const g=x.systemic.gasExchange;
    const err=g.paco2MmHg-e.pre_pco2;
    const row={deadspace,paco2:g.paco2MmHg,pao2:g.pao2MmHg,error:err,objective:Math.abs(err)};
    deadspaceRows.push(row);
    if(!bestDeadspace||row.objective<bestDeadspace.objective)bestDeadspace=row;
  }catch(err){
    deadspaceRows.push({deadspace,errorMessage:String(err.message||err)});
  }
}

// Stage 2: PaO2 maintenance with dead space fixed.
let bestVpf=null;
const vpfRows=[];
for(const vpf of VPF){
  try{
    const s=makeSession({deadspace:bestDeadspace.deadspace,vpf});
    s.initialize();
    const x=s.runFor(10);
    const g=x.systemic.gasExchange;
    const po2Err=g.pao2MmHg-e.pre_po2;
    const pco2Err=g.paco2MmHg-e.pre_pco2;
    const objective=Math.pow(po2Err/10,2)+Math.pow(pco2Err/5,2);
    const row={vpf,pao2:g.pao2MmHg,paco2:g.paco2MmHg,po2Err,pco2Err,objective};
    vpfRows.push(row);
    if(!bestVpf||objective<bestVpf.objective)bestVpf=row;
  }catch(err){
    vpfRows.push({vpf,errorMessage:String(err.message||err)});
  }
}

// Stage 3: screen CO2 load at 120 s, then confirm only the best two
// candidates over the requested horizon. This avoids brute-force long runs.
const CO2_SCREEN_SEC=Math.min(120,FIT_HORIZON_SEC);
const co2ScreenRows=[];
for(const co2Production of CO2_PRODUCTION){
  try{
    const s=makeSession({deadspace:bestDeadspace.deadspace,vpf:bestVpf.vpf,co2Production});
    s.initialize();
    const x=s.runFor(CO2_SCREEN_SEC);
    const g=x.systemic.gasExchange;
    const po2Err=g.pao2MmHg-e.pre_po2;
    const pco2Err=g.paco2MmHg-e.pre_pco2;
    const objective=Math.pow(po2Err/10,2)+Math.pow(pco2Err/5,2);
    co2ScreenRows.push({co2Production,pao2:g.pao2MmHg,paco2:g.paco2MmHg,pH:g.pH,po2Err,pco2Err,objective});
  }catch(err){
    co2ScreenRows.push({co2Production,errorMessage:String(err.message||err)});
  }
}
const shortlist=co2ScreenRows
  .filter(r=>Number.isFinite(r.objective))
  .sort((a,b)=>a.objective-b.objective)
  .slice(0,FIT_HORIZON_SEC>CO2_SCREEN_SEC?2:1);

let bestCo2Production=null;
const co2ProductionRows=[];
for(const screened of shortlist){
  try{
    const s=makeSession({
      deadspace:bestDeadspace.deadspace,
      vpf:bestVpf.vpf,
      co2Production:screened.co2Production
    });
    s.initialize();
    const x=s.runFor(FIT_HORIZON_SEC);
    const g=x.systemic.gasExchange;
    const po2Err=g.pao2MmHg-e.pre_po2;
    const pco2Err=g.paco2MmHg-e.pre_pco2;
    const objective=Math.pow(po2Err/10,2)+Math.pow(pco2Err/5,2);
    const row={co2Production:screened.co2Production,pao2:g.pao2MmHg,paco2:g.paco2MmHg,pH:g.pH,po2Err,pco2Err,objective};
    co2ProductionRows.push(row);
    if(!bestCo2Production||objective<bestCo2Production.objective)bestCo2Production=row;
  }catch(err){
    co2ProductionRows.push({co2Production:screened.co2Production,errorMessage:String(err.message||err)});
  }
}
if(!bestCo2Production) throw new Error('no finite CO2-production candidate after full-horizon confirmation');

// Final long-horizon stability check uses the selected candidate once.
const finalSession=makeSession({deadspace:bestDeadspace.deadspace,vpf:bestVpf.vpf,co2Production:bestCo2Production.co2Production,dtSec:CONFIRM_DT_SEC});
finalSession.initialize();
const final=finalSession.runFor(FIT_HORIZON_SEC);

const out={
  event_id:e.event_id,
  observed_pre:{pao2:e.pre_po2,paco2:e.pre_pco2,pH:e.pre_ph},
  bestDeadspace,
  bestVpf,
  bestTissueCo2Production:bestCo2Production,
  fitHorizonSec:FIT_HORIZON_SEC,
  searchDtSec:SEARCH_DT_SEC,
  confirmDtSec:CONFIRM_DT_SEC,
  finalStability:{
    pao2:final.systemic.gasExchange.pao2MmHg,
    paco2:final.systemic.gasExchange.paco2MmHg,
    pH:final.systemic.gasExchange.pH,
    vpf:final.systemic.gasExchange.ventilatedPerfusionFraction,
  },
  deadspaceRows,vpfRows,co2ScreenRows,co2ProductionRows,
  truth_file_read:false,
};
fs.writeFileSync(OUT,JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out));
