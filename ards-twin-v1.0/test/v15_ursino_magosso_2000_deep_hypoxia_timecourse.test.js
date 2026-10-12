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

const DT=0.002;

function mean(r,seconds){
  const n=Math.round(seconds/DT);
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

function rampPao2(r,{fromMmHg,toMmHg,seconds,paco2MmHg}){
  const n=Math.round(seconds/DT);
  for(let i=0;i<n;i++){
    const fraction=(i+1)/n;
    r.setEnvironment({
      pao2MmHg:fromMmHg+(toMmHg-fromMmHg)*fraction,
      paco2MmHg,
    });
    r.step();
  }
}

let result=null;

test('source spontaneous-VT mode follows the Fig11 deep-hypoxia protocol',()=>{
  const r=createGasCardiovascularClosedLoopCandidate({
    dtSec:DT,
    pao2MmHg:95,
    paco2MmHg:40,
    ventilationMode:'ursino-magosso-2000-spontaneous-validation',
  });

  r.runFor(120);
  const baseline=mean(r,5);

  // Ursino & Magosso 2000 Fig. 11 decreases PaO2 from 95 to 28 mmHg
  // over 10 s, then maintains deep isocapnic hypoxia.
  rampPao2(r,{
    fromMmHg:95,
    toMmHg:28,
    seconds:10,
    paco2MmHg:40,
  });
  const endRamp=mean(r,2);

  r.setEnvironment({pao2MmHg:28,paco2MmHg:40});
  r.runFor(8);
  const earlyHold=mean(r,2);
  r.runFor(10);
  const late=mean(r,10);

  result={baseline,endRamp,earlyHold,late};

  assert(
    endRamp.vt>baseline.vt,
    'VT should begin increasing after the delayed chemoreceptor pathway activates'
  );
  assert(
    late.vt>endRamp.vt,
    'VT should continue toward its stimulated source response'
  );
});

test('deep hypoxia shows the source biphasic HR pattern',()=>{
  assert(result);
  assert(
    result.endRamp.hr<result.baseline.hr,
    'HR should be below baseline near the end of the early hypoxic phase'
  );
  assert(
    result.late.hr>result.endRamp.hr,
    'later lung-stretch/CNS pathways should reverse the early HR fall'
  );
});

test('late source response increases cardiac output relative to the early phase',()=>{
  assert(result);
  assert(
    result.late.co>result.endRamp.co,
    'late cardiac output should exceed the early-phase value'
  );
});

test('source validation mode never claims bedside ventilator authority',()=>{
  const r=createGasCardiovascularClosedLoopCandidate({
    dtSec:DT,
    ventilationMode:'ursino-magosso-2000-spontaneous-validation',
  });
  const s=r.step();
  assert.equal(s.authority,'candidate-not-canonical');
  assert.equal(s.canonicalControlAuthority,false);
  assert.equal(s.ventilation.canonicalVentilatorAuthority,false);
});

console.log(JSON.stringify({
  schema:'ursino-magosso-2000-deep-hypoxia-timecourse/v2',
  authority:'source-reproduction-candidate-not-canonical',
  sourceProtocol:'PaO2 95 to 28 mmHg over 10 s, then held; isocapnic',
  result,
},null,2));

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
