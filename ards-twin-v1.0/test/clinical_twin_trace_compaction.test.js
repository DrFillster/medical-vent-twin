'use strict';

const assert=require('node:assert/strict');
const {
  LIVE_HUMMOD_REFERENCE_CASE_ID,
  createBerlinLiveHumModSession,
}=require('../src/clinical_twin_live_hummod_session.js');

function make(){
  return createBerlinLiveHumModSession({
    caseId:LIVE_HUMMOD_REFERENCE_CASE_ID,
    ventilation:{
      mode:'VC_AC',fio2:0.5,peep:8,rr:18,vtL:0.42,
      inspiratoryFlowLps:0.55,inspiratoryPauseSec:0
    },
    initialRecruitmentState:{normal:1,recruitable:0.35,consolidated:0},
    dt:0.01,
    mechanicalWarmupSec:5,
  });
}

const a=make();
const b=make();
a.initialize();
b.initialize();

for(let i=0;i<6;i++){
  a.runFor(20);
  b.runFor(20);
  b.compactTraceHistory(60);
}

const x=a.snapshot(), y=b.snapshot();
function near(p,q,tol,label){
  assert(Number.isFinite(p)&&Number.isFinite(q),label+' must be finite');
  assert(Math.abs(p-q)<=tol,label+': '+p+' vs '+q);
}
near(x.systemic.gasExchange.pao2MmHg,y.systemic.gasExchange.pao2MmHg,1e-9,'PaO2');
near(x.systemic.gasExchange.paco2MmHg,y.systemic.gasExchange.paco2MmHg,1e-9,'PaCO2');
near(x.systemic.hemodynamics.heartRatePerMin,y.systemic.hemodynamics.heartRatePerMin,1e-9,'HR');
near(x.systemic.hemodynamics.meanArterialPressureMmHg,y.systemic.hemodynamics.meanArterialPressureMmHg,1e-9,'MAP');
assert(b.simulation.trace.length<a.simulation.trace.length,'compaction must reduce retained trace rows');
assert(b.simulation.trace.length<=7000,'60 s at dt 0.01 should retain bounded trace rows');
console.log('ok - trace compaction preserves physiologic state while bounding history');
