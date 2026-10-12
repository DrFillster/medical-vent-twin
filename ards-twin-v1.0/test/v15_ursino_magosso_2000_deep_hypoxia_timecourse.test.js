'use strict';

const assert=require('node:assert/strict');
const {
  createGasCardiovascularClosedLoopCandidate,
}=require('../src/ursino_magosso_gas_closed_loop_candidate.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}

function mean(r,seconds){
  const dt=0.002;
  const n=Math.round(seconds/dt);
  let hr=0,map=0,co=0,vt=0;
  for(let i=0;i<n;i++){
    const s=r.snapshot();
    hr+=s.hemodynamics.heartRatePerMin;
    map+=s.hemodynamics.systemicArterialPressureMmHg;
    co+=s.hemodynamics.leftVentricleOutflowMlPerSec;
    vt+=s.ventilation.activeTidalVolumeL;
    r.step();
  }
  return {hr:hr/n,map:map/n,co:co/n,vt:vt/n};
}

let result=null;

test('source spontaneous-VT mode produces delayed ventilatory recruitment in deep hypoxia',()=>{
  const r=createGasCardiovascularClosedLoopCandidate({
    dtSec:0.002,
    pao2MmHg:95,
    paco2MmHg:40,
    ventilationMode:'ursino-magosso-2000-spontaneous-validation',
  });

  r.runFor(120);
  const baseline=mean(r,5);
  r.setEnvironment({pao2MmHg:28,paco2MmHg:40});

  const first8=mean(r,8);
  const next12=mean(r,12);
  const late=mean(r,20);

  result={baseline,first8,next12,late};

  assert(
    first8.vt<=baseline.vt+1e-3,
    'source VT response should remain delayed during the early chemoreflex phase'
  );
  assert(
    late.vt>first8.vt,
    'tidal volume should rise after the delayed source ventilatory pathway activates'
  );
});

test('deep hypoxia response is biphasic in HR direction rather than fixed bradycardia',()=>{
  assert(result);
  assert(
    result.first8.hr<result.baseline.hr,
    'early deep hypoxia should decrease HR in the source model'
  );
  assert(
    result.late.hr>result.first8.hr,
    'later source pathways should reverse the early HR fall'
  );
});

test('source validation mode never claims bedside ventilator authority',()=>{
  const r=createGasCardiovascularClosedLoopCandidate({
    dtSec:0.002,
    ventilationMode:'ursino-magosso-2000-spontaneous-validation',
  });
  const s=r.step();
  assert.equal(s.authority,'candidate-not-canonical');
  assert.equal(s.canonicalControlAuthority,false);
  assert.equal(s.ventilation.canonicalVentilatorAuthority,false);
  assert.equal(s.protocolScope.spontaneousBreathing,true);
  assert.equal(s.protocolScope.deliveredTidalVolumeOwnedByVent,false);
  assert.equal(s.protocolScope.sourceVentilationOwnsValidationVT,true);
});

console.log(JSON.stringify({
  schema:'ursino-magosso-2000-deep-hypoxia-timecourse/v1',
  authority:'source-reproduction-candidate-not-canonical',
  result,
},null,2));

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
