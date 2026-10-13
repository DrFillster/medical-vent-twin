'use strict';

const assert=require('node:assert/strict');
const {
  createBerlinV16ArdsSession,
}=require('../src/clinical_twin_v16_ards_session.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.stack||e.message);failed++;}
}

function createSession(){
  return createBerlinV16ArdsSession({
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
    initialRecruitmentState:{
      normal:1,
      recruitable:0.35,
      consolidated:0,
    },
    anatomicalShuntFraction:0.35,
    excessLungWaterMl:0,
    dt:0.002,
  });
}

test('v1.6 browser session initializes to physician dashboard contract',()=>{
  const s=createSession().initialize();
  assert.equal(
    s.sessionSchema,
    'berlin-clinical-twin-v16-integrated-ards-session/v1'
  );
  assert.equal(s.systemic.status,'live-coupled-candidate');
  assert(Number.isFinite(s.systemic.gasExchange.pao2MmHg));
  assert(Number.isFinite(s.systemic.gasExchange.paco2MmHg));
  assert(Number.isFinite(s.systemic.gasExchange.pH));
  assert(Number.isFinite(s.systemic.hemodynamics.heartRatePerMin));
  assert(Number.isFinite(s.systemic.hemodynamics.meanArterialPressureMmHg));
  assert(Number.isFinite(s.systemic.hemodynamics.cardiacOutputMlPerMin));
  assert.equal(s.pulmonary.anatomicalShuntFraction,0.35);
  assert.equal(s.engineeringBoundaries.anatomicalShunt.status,'explicit-case-input');
  assert.equal(
    s.engineeringBoundaries.pulmonaryReference
      .absoluteAlveolarVolumeProvenance.sourceQualified,
    true
  );
  assert.equal(
    s.engineeringBoundaries.pulmonaryReference
      .pleuralPressureProvenance.sourceQualified,
    true
  );
  assert(
    s.engineeringBoundaries.pulmonaryReference.derivedSplitInitialization,
    'integrated runtime must expose its source-derived split pulmonary initialization'
  );
});

test('browser session preserves one patient across PEEP and ventilation changes',()=>{
  const x=createSession();
  const before=x.initialize();
  const t0=before.timeSec;
  x.setPEEP(12);
  x.runFor(0.5);
  x.requestVentilationChange({
    mode:'VC_AC',
    fio2:0.80,
    peep:12,
    rr:24,
    vtL:0.36,
    inspiratoryFlowLps:0.70,
    inspiratoryPauseSec:0.20,
  });
  const after=x.runFor(4);
  assert(after.timeSec>t0);
  assert.equal(after.ventilator.peepCmH2O,12);
  assert.equal(after.ventilator.fio2,0.80);
  assert.equal(after.ventilator.rrPerMin,24);
  assert.equal(after.ventilator.vtL,0.36);
  assert.equal(after.pulmonary.anatomicalShuntFraction,0.35);
});

test('browser session refuses implicit shunt and lung water',()=>{
  assert.throws(()=>createBerlinV16ArdsSession({
    caseId:'berlin-moderate-moderate-aspiration',
    ventilation:{
      mode:'VC_AC',fio2:0.6,peep:8,rr:20,vtL:0.42,
      inspiratoryFlowLps:0.7,inspiratoryPauseSec:0.2,
    },
    initialRecruitmentState:{
      normal:1,recruitable:0.35,consolidated:0,
    },
  }));
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
