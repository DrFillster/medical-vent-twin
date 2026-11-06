'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {createBerlinLiveHumModSession}=
  require('../src/clinical_twin_live_hummod_session.js');

let passed=0,failed=0;
function test(name,fn){try{fn();console.log('ok -',name);passed++;}catch(e){console.error('FAIL -',name,':',e.message);failed++;}}
function assert(v,m){if(!v)throw new Error(m||'assertion failed');}

const runtime=fs.readFileSync(
  path.join(__dirname,'../src/hummod_ards_cardiopulmonary_runtime.js'),
  'utf8');

test('source-aligned HR does not add empirical hypercapnic chronotropy',()=>{
  assert(runtime.includes('const appliedEmpiricalChronotropicBoostPerMin = 0;'),
    'source-aligned fidelity path must keep empirical HR overlay disabled');
  // Verify the actual source-rate boundary for both supported source models;
  // formatting a ternary expression is not a physiological fidelity check.
  for(const heartRateControlMode of ['source-aligned','hummod2013-baro-chemo']){
    const session=createBerlinLiveHumModSession({
      caseId:'berlin-moderate-moderate-aspiration',heartRateControlMode,
      ventilation:{mode:'VC_AC',fio2:.3,peep:3,rr:4,vtL:.42,
        inspiratoryFlowLps:.7,inspiratoryPauseSec:.2},
      initialRecruitmentState:{normal:1,recruitable:.35,consolidated:0},dt:.002,
    });
    session.initialize();
    const h=session.runFor(10).systemic.hemodynamics;
    const source=heartRateControlMode==='source-aligned'
      ?h.sourceSaNodeHeartRatePerMin
      :Math.max(0,Math.min(260,h.hummod2013HeartRateState.heartRatePerMin));
    assert(h.empiricalChronotropicBoostPerMin===0,'empirical HR boost must stay zero');
    assert(Math.abs(h.selectedHeartRatePerMin-source)<1e-12,
      'selected HR must equal the chosen HumMod source SA-node rate');
    assert(Math.abs(h.heartRatePerMin-source*h.chronotropicReserveMultiplier)<1e-12,
      'circulation must receive source rate times explicit chronotropic reserve');
  }
  assert(!runtime.includes('sourceSaNodeHeartRatePerMin + appliedEmpiricalChronotropicBoostPerMin'),
    'empirical boost must not be summed into HumMod SA-node rate');
});

test('source-aligned runtime carries brain hypoxia state into autonomic control',()=>{
  assert(runtime.includes('createHumModSourceAlignedBrainHypoxia'),
    'brain hypoxia controller must be instantiated');
  assert(runtime.includes('brainHypoxiaState.brainFunctionEffect'),
    'Brain-Function effect must reach source autonomic control');
  assert(runtime.includes('brainHypoxia:brainHypoxiaState'),
    'brain hypoxia state must be preserved for diagnostics');
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
