'use strict';

const assert=require('node:assert/strict');
const {
  createBerlinLiveHumModSession,
}=require('../src/clinical_twin_live_hummod_session.js');

const s=createBerlinLiveHumModSession({
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

const x=s.initialize();
const shadow=x.systemic.autonomicShadow;

assert(shadow,'autonomic shadow missing');
assert(shadow.heartPeriod,'heart-period shadow not exported');
assert(shadow.downstreamEffectors,'downstream effector shadow not exported');

assert(Number.isFinite(
  shadow.downstreamEffectors.regionalResistance?.splanchnic?.value
),'splanchnic resistance must be numeric after initialization');

assert(Number.isFinite(
  shadow.downstreamEffectors.ventricularElastance?.left?.value
),'LV Emax must be numeric after initialization');

assert(Number.isFinite(
  x.systemic.physicianComparison?.publishedModelInterim?.heartRatePerMin
),'published-model interim HR must be numeric after initialization');

console.log('ok - physician shadow exports HR, splanchnic resistance, and LV Emax');
