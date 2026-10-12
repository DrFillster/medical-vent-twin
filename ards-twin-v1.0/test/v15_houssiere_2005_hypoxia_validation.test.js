'use strict';

const assert=require('node:assert/strict');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}

let result=null;

test('Houssiere protocol executes without hidden gas-coordinate equivalence',()=>{
  const run=spawnSync(process.execPath,[
    path.resolve(__dirname,'../scripts/houssiere-2005-isocapnic-hypoxia-validation.js')
  ],{encoding:'utf8',timeout:180000,maxBuffer:4*1024*1024});
  assert.equal(run.status,0,run.stderr||run.stdout);
  result=JSON.parse(run.stdout);
  assert.equal(result.authority,'external-validation-only');
  assert.match(result.coordinateWarning,/not an exact subject PaO2/);
  assert.equal(result.protocolMapping.candidatePaCO2MmHg,40);
  assert.equal(
    result.protocolMapping.ventilationMode,
    'ursino-magosso-2000-spontaneous-validation'
  );
});

test('candidate produces finite HR MAP and spontaneous VT during the protocol',()=>{
  assert(result);
  for(const phase of [result.candidate.baseline,result.candidate.hypoxia]){
    for(const key of ['hrPerMin','mapMmHg','vtL']){
      assert(Number.isFinite(phase[key]),key);
    }
  }
});

test('candidate hypoxia response direction can be compared without gain fitting',()=>{
  assert(result);
  assert.equal(result.qualitativeComparison.hrDirection,'increase');
  assert.equal(result.qualitativeComparison.status,'validation-only-not-calibration');
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
