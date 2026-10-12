'use strict';

const assert=require('node:assert/strict');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}

let challenge=null;
let run=null;

test('source-reproduction challenge executes and returns v3 audit',()=>{
  const script=path.resolve(__dirname,'../scripts/ursino-1998-closed-loop-challenge.js');
  run=spawnSync(process.execPath,[script],{
    encoding:'utf8',
    timeout:120000,
    maxBuffer:2*1024*1024,
  });
  assert.equal(run.status,0,run.stderr||run.stdout);
  challenge=JSON.parse(run.stdout);
  assert.equal(challenge.schema,'ursino-1998-closed-loop-source-reproduction/v3');
  assert.equal(challenge.authority,'candidate-not-canonical');
  assert.match(challenge.acceptance,/UNASSESSED/);
});

test('challenge preserves the primary 10 percent over 5 second hemorrhage protocol',()=>{
  assert(challenge);
  assert.equal(challenge.method.totalLossMl,530);
  const duration=challenge.method.hemorrhageEndSec-challenge.method.hemorrhageStartSec;
  assert(Math.abs(duration-5)<0.01,'hemorrhage duration must remain 5 s');
  assert(Math.abs(challenge.baseline.totalBloodVolumeMl-5300)<1e-6);
  assert(Math.abs(challenge.post80.totalBloodVolumeMl-4770)<1e-5);
});

test('source-style means use at least 20 seconds and integer cardiac cycles',()=>{
  assert(challenge);
  for(const block of [challenge.baseline,challenge.post80]){
    assert(block.traceSec>=20);
    assert(Number.isInteger(block.beats));
    assert(block.beats>0);
    assert(block.endTimeSec>block.startTimeSec);
  }
});

test('candidate retains source-consistent hemorrhage response directions without a numeric pass claim',()=>{
  assert(challenge);
  assert(challenge.percentChanges.sap<0,'SAP should fall');
  assert(challenge.percentChanges.cardiacOutput<0,'CO should fall');
  assert(challenge.percentChanges.systemicResistance>0,'systemic resistance should rise');
  assert(challenge.percentChanges.hr>0,'HR should rise');
  assert.match(challenge.acceptance,/compare/i);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
