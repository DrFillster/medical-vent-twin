'use strict';

const assert=require('node:assert/strict');
const {
  createBerlinLiveHumModSession,
}=require('../src/clinical_twin_live_hummod_session.js');

const session=createBerlinLiveHumModSession({
  caseId:'berlin-moderate-moderate-aspiration',
  ventilation:{
    mode:'VC_AC',
    fio2:0.60,
    peep:8,
    rr:20,
    vtL:0.42,
    inspiratoryFlowLps:0.70,
    inspiratoryPauseSec:0.20,
  },
  initialRecruitmentState:{normal:1,recruitable:0.35,consolidated:0},
  dt:0.002,
  mechanicalWarmupSec:3,
});

let snap=session.initialize();
snap=session.runFor(5);

const shadow=snap.systemic.autonomicShadow;
assert.ok(shadow);
assert.equal(shadow.controlAuthority,false);
assert.equal(shadow.authority,'shadow-diagnostic-only');
assert.ok(Number.isFinite(shadow.baroreceptor.fAbSpikesPerSec));
assert.ok(Number.isFinite(shadow.fAbSpikesPerSec));
assert.ok(Number.isFinite(shadow.fAcSpikesPerSec));
assert.ok(Number.isFinite(shadow.fApSpikesPerSec));
assert.ok(Number.isFinite(shadow.thetaSpSpikesPerSec));
assert.ok(Number.isFinite(shadow.thetaShSpikesPerSec));
assert.ok(Number.isFinite(shadow.fSpSpikesPerSec));
assert.ok(Number.isFinite(shadow.fShSpikesPerSec));
assert.ok(Number.isFinite(shadow.fVSpikesPerSec));
assert.equal(shadow.baroreceptorMappingStatus,'explicit-f_ab-input-supplied');

const hemo=snap.systemic.hemodynamics;
assert.ok(Number.isFinite(hemo.heartRatePerMin));
assert.equal(hemo.empiricalChronotropicBoostPerMin,0);

console.log('ok - v1.5 full autonomic shadow chain is finite and non-authoritative');
