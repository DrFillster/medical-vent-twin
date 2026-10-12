'use strict';

const assert=require('node:assert/strict');
const {
  LIVE_HUMMOD_REFERENCE_CASE_ID,
  createBerlinLiveHumModSession,
}=require('../src/clinical_twin_live_hummod_session.js');

function make(enabled){
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

const on=make(true);
const off=make(false);

const a0=on.initialize();
const b0=off.initialize();
assert.deepEqual(liveVector(a0),liveVector(b0));

const c0=a0.systemic.physicianComparison.hummod2013Compensation;
assert(c0,'HumMod 2013 physician comparison must be present');
assert(Number.isFinite(c0.heartRatePerMin));
assert(Number.isFinite(c0.chemoreceptorFiringRate));
assert(Number.isFinite(c0.chemoCnsEffect));
assert(Number.isFinite(c0.cardiacSympatheticHz));
assert(Number.isFinite(c0.adrenalSympatheticHz));
assert(Number.isFinite(c0.generalSympatheticHz));
assert(Number.isFinite(c0.epinephrinePgPerMl));
assert(Number.isFinite(c0.norepinephrinePgPerMl));
assert(Number.isFinite(c0.beta1Effect));
assert.equal(c0.authority,'candidate-not-canonical');
assert.equal(c0.controlAuthority,false);
assert.equal(b0.systemic.physicianComparison.hummod2013Compensation,null);

const a1=on.runFor(10);
const b1=off.runFor(10);
assert.deepEqual(liveVector(a1),liveVector(b1));

on.setPEEP(14);
off.setPEEP(14);
const a2=on.runFor(10);
const b2=off.runFor(10);
assert.deepEqual(liveVector(a2),liveVector(b2));

assert(
  Number.isFinite(a2.systemic.physicianComparison.hummod2013Compensation.heartRatePerMin)
);
assert.equal(
  a2.systemic.physicianComparison.hummod2013Compensation.controlAuthority,
  false
);

console.log('ok - HumMod 2013 physician comparison is observational and live-invariant');
