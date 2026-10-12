'use strict';

const assert=require('node:assert/strict');
const {
  LIVE_HUMMOD_REFERENCE_CASE_ID,
  createBerlinLiveHumModSession,
}=require('../src/clinical_twin_live_hummod_session.js');

function makeSession(enabled){
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
    physicianValidationCandidate:enabled,
  });
}

function liveVector(snapshot){
  const h=snapshot.systemic.hemodynamics;
  return {
    timeSec:snapshot.timeSec,
    hr:h.heartRatePerMin,
    map:h.meanArterialPressureMmHg,
    co:h.cardiacOutputMlPerMin,
    sv:h.strokeVolumeMl,
    svr:h.systemicVascularResistanceMmHgMinPerL,
    pvr:h.pulmonaryVascularResistanceMmHgMinPerL,
    pao2:snapshot.systemic.gasExchange.pao2MmHg,
    paco2:snapshot.systemic.gasExchange.paco2MmHg,
    ph:snapshot.systemic.gasExchange.pH,
  };
}

function exactEqual(a,b,label){
  assert.deepEqual(a,b,label);
}

const withCandidate=makeSession(true);
const withoutCandidate=makeSession(false);

const initA=withCandidate.initialize();
const initB=withoutCandidate.initialize();

exactEqual(
  liveVector(initA),liveVector(initB),
  'parallel candidate must not alter initialized live patient'
);

const candidateInit=initA.systemic.physicianComparison.candidateModel;
assert(candidateInit,'candidate comparison must be present when enabled');
assert.equal(candidateInit.authority,'candidate-not-canonical');
assert.equal(candidateInit.controlAuthority,false);
assert(Number.isFinite(candidateInit.heartRatePerMin));
assert(Number.isFinite(candidateInit.meanArterialPressureMmHg));
assert(Number.isFinite(candidateInit.cardiacOutputMlPerMin));
assert(Number.isFinite(candidateInit.strokeVolumeMl));
assert(Number.isFinite(candidateInit.systemicPeripheralResistanceMmHgMinPerL));
assert.equal(initB.systemic.physicianComparison.candidateModel,null);

const runA=withCandidate.runFor(10);
const runB=withoutCandidate.runFor(10);
exactEqual(
  liveVector(runA),liveVector(runB),
  'parallel candidate must not alter live patient after time advance'
);

withCandidate.setPEEP(14);
withoutCandidate.setPEEP(14);
const peepA=withCandidate.runFor(10);
const peepB=withoutCandidate.runFor(10);
exactEqual(
  liveVector(peepA),liveVector(peepB),
  'parallel candidate must not alter live response to ventilator intervention'
);

console.log('ok - physician validation candidate is observational only');
console.log('candidate',JSON.stringify(peepA.systemic.physicianComparison.candidateModel));
