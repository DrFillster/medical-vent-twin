'use strict';

const assert=require('node:assert/strict');
const {
  createV16PhysicianArdsBrowserSession,
}=require('../src/v16_physician_ards_browser_session.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.stack||e.message);failed++;}
}

function createSession(){
  return createV16PhysicianArdsBrowserSession({
    caseId:'berlin-moderate-moderate-aspiration',
    ventilation:{
      mode:'VC_AC',
      fio2:0.6,
      peep:10,
      rr:20,
      vtL:0.42,
      inspiratoryFlowLps:0.5,
      inspiratoryPauseSec:0,
    },
    initialRecruitmentState:{
      normal:1,recruitable:0.5,consolidated:0,
    },
    anatomicalShuntFraction:0.05,
    excessLungWaterMl:0,
    dt:0.002,
  });
}

test('browser adapter exposes existing monitor schema without owning physiology',()=>{
  const s=createSession();
  s.runFor(3.2);
  const x=s.snapshot();
  assert.equal(x.sessionSchema,'v16-physician-ards-browser-session/v1');
  assert.equal(x.coupling.mode,'v1.6-integrated-ards-candidate');
  assert.equal(x.browserAdapter.physiologyAuthority,false);
  assert(Number.isFinite(x.systemic.gasExchange.pao2MmHg));
  assert(Number.isFinite(x.systemic.hemodynamics.heartRatePerMin));
  assert(Number.isFinite(x.systemic.hemodynamics.meanArterialPressureMmHg));
  assert(Number.isFinite(x.systemic.hemodynamics.cardiacOutputMlPerMin));
  assert(Array.isArray(x.pulmonary.recentWaveform));
});

test('browser adapter preserves persistent Vent interventions',()=>{
  const s=createSession();
  s.runFor(3.2);
  const t=s.snapshot().timeSec;
  s.setPEEP(14);
  s.runFor(0.2);
  const x=s.snapshot();
  assert(x.timeSec>t);
  assert.equal(x.ventilator.peepCmH2O,14);
});

test('browser adapter refuses to infer case shunt',()=>{
  assert.throws(()=>createV16PhysicianArdsBrowserSession({
    caseId:'berlin-moderate-moderate-aspiration',
    ventilation:{
      mode:'VC_AC',fio2:0.6,peep:10,rr:20,vtL:0.42,
      inspiratoryFlowLps:0.5,inspiratoryPauseSec:0,
    },
    initialRecruitmentState:{normal:1,recruitable:0.5,consolidated:0},
    excessLungWaterMl:0,
  }),/anatomicalShuntFraction/);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
