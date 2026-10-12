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

function pct(a,b){return 100*(a-b)/b;}

function runProtocol({
  baselineSec,
  challengeSec,
  pao2Baseline,
  paco2Baseline,
  pao2Challenge,
  paco2Challenge,
  tidalVolumeL,
}){
  const r=createGasCardiovascularClosedLoopCandidate({
    dtSec:0.002,
    pao2MmHg:pao2Baseline,
    paco2MmHg:paco2Baseline,
    tidalVolumeL,
  });
  r.runFor(baselineSec);
  const before=r.snapshot();
  r.setEnvironment({
    pao2MmHg:pao2Challenge,
    paco2MmHg:paco2Challenge,
  });
  r.runFor(challengeSec);
  const after=r.snapshot();
  return {
    before,
    after,
    hrPct:pct(
      after.hemodynamics.heartRatePerMin,
      before.hemodynamics.heartRatePerMin
    ),
    mapPct:pct(
      after.hemodynamics.systemicArterialPressureMmHg,
      before.hemodynamics.systemicArterialPressureMmHg
    ),
  };
}

let hypoxia,hypercapnia;

test('Halliwill-style isocapnic hypoxia has source-consistent direction',()=>{
  hypoxia=runProtocol({
    baselineSec:120,
    challengeSec:120,
    pao2Baseline:100,
    paco2Baseline:40,
    pao2Challenge:50,
    paco2Challenge:40,
    tidalVolumeL:0.5,
  });
  assert(hypoxia.hrPct>0,'HR should rise in isocapnic hypoxia');
  assert(hypoxia.mapPct>0,'MAP should rise in isocapnic hypoxia');
});

test('Simmons-style mild hypercapnia is weaker than hypoxia for HR response',()=>{
  hypercapnia=runProtocol({
    baselineSec:120,
    challengeSec:120,
    pao2Baseline:100,
    paco2Baseline:40,
    pao2Challenge:100,
    paco2Challenge:45,
    tidalVolumeL:0.5,
  });
  assert(hypercapnia.hrPct>0,'mild hypercapnia should not produce bradycardia');
  assert(
    hypercapnia.hrPct<hypoxia.hrPct,
    'mild hypercapnia HR response should be weaker than isocapnic hypoxia'
  );
});

test('mild hypercapnia does not create a large pressor response',()=>{
  assert(
    Math.abs(hypercapnia.mapPct)<Math.abs(hypoxia.mapPct),
    'mild hypercapnia MAP response should remain smaller than hypoxia response'
  );
});

console.log(JSON.stringify({
  schema:'human-autonomic-validation-smoke/v1',
  authority:'validation-only-not-calibration',
  protocols:{
    halliwillStyleIsocapnicHypoxia:{
      pao2MmHg:50,paco2MmHg:40,
      hrPct:hypoxia?.hrPct,
      mapPct:hypoxia?.mapPct,
      humanReference:{
        citation:'Halliwill et al. J Physiol. 2003;552:295-302.',
        doi:'10.1113/jphysiol.2003.050708',
        observed:'HR and MAP increased during acute isocapnic hypoxia',
      },
    },
    simmonsStyleMildHypercapnia:{
      pao2MmHg:100,paco2MmHg:45,
      hrPct:hypercapnia?.hrPct,
      mapPct:hypercapnia?.mapPct,
      humanReference:{
        citation:'Simmons et al. J Physiol. 2007;583:1155-1163.',
        doi:'10.1113/jphysiol.2007.137216',
        observed:'small HR increase with essentially unchanged MAP during mild hypercapnia',
      },
    },
  },
},null,2));

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
