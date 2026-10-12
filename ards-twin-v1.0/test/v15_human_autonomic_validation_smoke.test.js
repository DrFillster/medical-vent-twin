'use strict';

const assert=require('node:assert/strict');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
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
  tidalVolumeBaselineL,
  tidalVolumeChallengeL,
}){
  const r=createGasCardiovascularClosedLoopCandidate({
    dtSec:0.002,
    pao2MmHg:pao2Baseline,
    paco2MmHg:paco2Baseline,
    tidalVolumeL:tidalVolumeBaselineL,
  });
  r.runFor(baselineSec);
  const before=r.snapshot();
  r.setEnvironment({
    pao2MmHg:pao2Challenge,
    paco2MmHg:paco2Challenge,
    tidalVolumeL:tidalVolumeChallengeL,
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

let halliwill=null;
let hypercapnia=null;

test('Halliwill matched hyperpnoea validation passes inside the integrated candidate',()=>{
  const run=spawnSync(process.execPath,[
    path.resolve(__dirname,'../scripts/halliwill-2003-matched-hyperpnoea-validation.js')
  ],{
    encoding:'utf8',timeout:180000,maxBuffer:4*1024*1024,
  });
  assert.equal(run.status,0,run.stderr||run.stdout);
  halliwill=JSON.parse(run.stdout);
  assert(halliwill.hypoxia.hrPerMin>halliwill.hyperpnoea.hrPerMin);
  assert(halliwill.hypoxia.mapMmHg>halliwill.hyperpnoea.mapMmHg);
});

test('mild hypercapnia remains a separate report-only external target',()=>{
  hypercapnia=runProtocol({
    baselineSec:120,
    challengeSec:120,
    pao2Baseline:100,
    paco2Baseline:40,
    pao2Challenge:100,
    paco2Challenge:45,
    tidalVolumeBaselineL:0.5,
    tidalVolumeChallengeL:0.5,
  });
  assert(Number.isFinite(hypercapnia.hrPct));
  assert(Number.isFinite(hypercapnia.mapPct));
});

console.log(JSON.stringify({
  schema:'human-autonomic-validation-smoke/v2',
  authority:'validation-only-not-calibration',
  halliwillMatchedHyperpnoea:halliwill&&{
    coordinateWarning:halliwill.coordinateWarning,
    hyperpnoea:halliwill.hyperpnoea,
    hypoxia:halliwill.hypoxia,
    humanReference:{
      citation:'Halliwill et al. J Physiol. 2003;552:295-302.',
      doi:'10.1113/jphysiol.2003.050708',
      observed:'With matched breathing and isocapnia, hypoxia increased HR and MAP beyond hyperpnoea alone.',
    },
  },
  simmonsMildHypercapniaReportOnly:hypercapnia&&{
    candidateHrPct:hypercapnia.hrPct,
    candidateMapPct:hypercapnia.mapPct,
    status:'report-only-protocol-coordinates-incomplete',
    humanReference:{
      citation:'Simmons et al. J Physiol. 2007;583:1155-1163.',
      doi:'10.1113/jphysiol.2007.137216',
      observed:'Mild hyperoxic hypercapnia increased HR slightly, while MAP did not significantly change; matched hyperpnoea produced a similar HR rise.',
    },
  },
},null,2));

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
