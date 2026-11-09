'use strict';
const assert=require('node:assert/strict');
const {LIVE_HUMMOD_REFERENCE_CASE_ID,createBerlinLiveHumModSession}=require('../src/clinical_twin_live_hummod_session.js');
const rec={normal:1,recruitable:.35,consolidated:0};
function make(ventilation,warmup=6){return createBerlinLiveHumModSession({caseId:LIVE_HUMMOD_REFERENCE_CASE_ID,ventilation,initialRecruitmentState:rec,dt:.002,mechanicalWarmupSec:warmup});}
{
 const s=make({mode:'PS',fio2:.6,peep:8,rr:2,pressureSupportCmH2O:8});s.initialize();const x=s.runFor(12);
 assert.equal(x.ventilator.mode,'PS');assert(x.ventilator.rrPerMin>8&&x.ventilator.rrPerMin<20);assert(Number.isFinite(x.systemic.gasExchange.paco2MmHg));
}
{
 const s=make({mode:'SIMV',fio2:.6,peep:8,rr:8,pinspCmH2O:12,inspiratoryTimeSec:.8,pressureSupportCmH2O:8});s.initialize();const x=s.runFor(12);
 assert.equal(x.ventilator.mode,'SIMV');assert(x.ventilator.rrPerMin>=8);assert(Number.isFinite(x.systemic.gasExchange.paco2MmHg));
}
{
 const s=make({mode:'VC_AC',fio2:.6,peep:8,rr:20,vtL:.42,inspiratoryFlowLps:.7,inspiratoryPauseSec:.2},3);s.initialize();const t0=s.simulation.state.t;
 s.requestVentilationChange({mode:'PS',fio2:.6,peep:8,rr:2,pressureSupportCmH2O:8});const x=s.runFor(12);
 assert.equal(x.ventilator.mode,'PS');assert(s.simulation.state.t>t0);assert(x.ventilator.rrPerMin>8&&x.ventilator.rrPerMin<20);
}
console.log('ok - live Hennigs-supported PS/SIMV modes and VC-to-PS transition remain executable');
