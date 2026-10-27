'use strict';

const {
  LIVE_HUMMOD_REFERENCE_CASE_ID,
  createBerlinLiveHumModSession,
}=require('../src/clinical_twin_live_hummod_session.js');

function makeSession(){
  return createBerlinLiveHumModSession({
    caseId:LIVE_HUMMOD_REFERENCE_CASE_ID,
    ventilation:{
      mode:'VC_AC',fio2:0.60,peep:8,rr:20,
      vtL:0.42,inspiratoryFlowLps:0.70,inspiratoryPauseSec:0.20,
    },
    initialRecruitmentState:{
      normal:1,recruitable:0.35,consolidated:0,
    },
    dt:0.002,
    mechanicalWarmupSec:3,
  });
}

function pick(s){
  const last=s.systemic;
  const h=last.hemodynamics;
  const g=last.gasExchange;
  const d=last.decompensation;
  return {
    tSec:s.timeSec,
    hrPerMin:h.heartRatePerMin,
    mapMmHg:h.meanArterialPressureMmHg,
    coMlPerMin:h.cardiacOutputMlPerMin,
    svMl:h.strokeVolumeMl,
    svrMmHgMinPerL:h.systemicVascularResistanceMmHgMinPerL,
    appliedSystemicConductance:h.systemicArterialConductanceMlPerMinPerMmHg,
    sourceAutonomicSystemicConductance:
      h.sourceAutonomicSystemicConductanceMlPerMinPerMmHg,
    pao2MmHg:g.pao2MmHg,
    paco2MmHg:g.paco2MmHg,
    pH:g.pH,
    oxygenDeliveryMlPerMin:g.oxygenDeliveryMlPerMin,
    stage:d?d.stage:null,
    cardiacArrest:d?d.cardiacArrest:false,
    arrestReason:d?d.cardiacArrestReason:null,
    lowMapBelow30Sec:d?d.lowMapBelow30Sec:null,
    lowMapBelow20Sec:d?d.lowMapBelow20Sec:null,
  };
}

const session=makeSession();
session.initialize();
session.runFor(60);
session.requestVentilationChange({
  mode:'VC_AC',fio2:0.20,peep:8,rr:4,
  vtL:0.10,inspiratoryFlowLps:0.20,inspiratoryPauseSec:0,
});

const samples=[];
let elapsed=0;
for(const target of [30,60,120,180,300,420,540,600]){
  const delta=target-elapsed;
  if(delta>0) session.runFor(delta);
  elapsed=target;
  samples.push(pick(session.snapshot()));
  if(samples[samples.length-1].cardiacArrest) break;
}

console.log(JSON.stringify({
  model:'v2.4 coupled systemic-vascular and arrest diagnostic',
  samples,
},null,2));
