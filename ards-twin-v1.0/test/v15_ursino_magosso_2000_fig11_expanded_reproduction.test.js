'use strict';

const assert=require('node:assert/strict');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}
let x=null;

test('expanded Fig11 reproduction script executes',()=>{
  const run=spawnSync(process.execPath,[
    path.resolve(__dirname,'../scripts/ursino-magosso-2000-fig11-expanded-reproduction.js')
  ],{encoding:'utf8',timeout:180000,maxBuffer:4*1024*1024});
  assert.equal(run.status,0,run.stderr||run.stdout);
  x=JSON.parse(run.stdout);
  assert.equal(x.authority,'source-reproduction-candidate-not-canonical');
  assert.equal(x.source.figure,'Fig. 11');
});

test('early 8-10 s phase reproduces source direction and redistribution',()=>{
  assert(x.early.hr<x.baseline.hr,'early HR must fall');
  assert(x.early.map>x.baseline.map,'early MAP must rise');
  assert(
    x.early.autoregulated>x.baseline.autoregulated,
    'autoregulated organ flow must rise'
  );
  assert(
    x.early.remaining<x.baseline.remaining,
    'remaining systemic flow must fall'
  );
});

test('later phase reverses early HR/CO suppression and restores remaining flow',()=>{
  assert(x.later.hr>x.early.hr,'later HR must exceed early HR');
  assert(x.later.co>x.early.co,'later CO must exceed early CO');
  assert(
    x.later.remaining>x.early.remaining,
    'remaining systemic flow must recover from early nadir'
  );
});

test('within one minute HR and MAP are above baseline as reported by source',()=>{
  assert(x.withinMinute.hr>x.baseline.hr,'HR must exceed baseline within 1 min');
  assert(x.withinMinute.map>x.baseline.map,'MAP must exceed baseline within 1 min');
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
