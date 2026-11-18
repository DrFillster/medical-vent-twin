'use strict';

const assert=require('node:assert/strict');
const {
  LIVE_HUMMOD_REFERENCE_CASE_ID,
  createBerlinLiveHumModSession,
}=require('../src/clinical_twin_live_hummod_session.js');

const s=createBerlinLiveHumModSession({
  caseId:LIVE_HUMMOD_REFERENCE_CASE_ID,
  ventilation:{mode:'VC_AC',fio2:0.5,peep:8,rr:18,vtL:0.5,inspiratoryFlowLps:0.6,inspiratoryPauseSec:0},
  initialRecruitmentState:{normal:1,recruitable:0.35,consolidated:0},
  patientDeadSpaceFractionOfTidalVolume:0.6,
  dt:0.01,
  mechanicalWarmupSec:5,
});
s.initialize();
let x=s.runFor(5);
assert.equal(x.coupling.patientDeadSpaceOverrideApplied,true);
assert.equal(x.coupling.patientDeadSpaceFractionOfTidalVolume,0.6);
assert.equal(x.systemic.coupling.deadSpaceSource,'explicit-fraction-of-current-tidal-volume');

s.requestVentilationChange({mode:'VC_AC',fio2:0.5,peep:8,rr:18,vtL:0.2,inspiratoryFlowLps:0.4,inspiratoryPauseSec:0});
x=s.runFor(8);
assert(Number.isFinite(x.systemic.gasExchange.paco2MmHg));
assert.equal(x.systemic.coupling.deadSpaceSource,'explicit-fraction-of-current-tidal-volume');
console.log('ok - fractional dead space tracks current tidal volume across VC change');
