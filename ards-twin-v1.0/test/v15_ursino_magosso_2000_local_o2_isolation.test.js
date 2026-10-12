'use strict';

const assert=require('node:assert/strict');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

let passed=0,failed=0,x=null;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}

test('beat-aligned local-O2 isolation diagnostic executes',()=>{
  const run=spawnSync(process.execPath,[
    path.resolve(__dirname,'../scripts/ursino-magosso-2000-local-o2-isolation.js')
  ],{encoding:'utf8',timeout:360000,maxBuffer:2*1024*1024});
  assert.equal(run.status,0,run.stderr||run.stdout);
  x=JSON.parse(run.stdout);
  assert.equal(x.schema,'ursino-magosso-2000-local-o2-isolation/v2');
  assert.equal(x.measurement,'complete-ventricular-cycle means');
});

test('source mode preserves early bradycardia and autoregulated redistribution',()=>{
  assert(x.source.pct.hr<0,'source-mode HR must fall early');
  assert(x.source.pct.autoregulated>0,'source-mode autoregulated flow must rise');
  assert(x.source.pct.remaining<0,'source-mode remaining flow must fall');
});

test('disabling local-O2 control raises early beat-aligned arterial pressure response',()=>{
  assert(
    x.disabled.pct.map>x.source.pct.map,
    'local-O2-disabled MAP response must exceed source-mode MAP response'
  );
});

test('local-O2 control is required for the source-direction autoregulated flow increase',()=>{
  assert(
    x.source.pct.autoregulated>x.disabled.pct.autoregulated,
    'source local-O2 control must increase autoregulated flow relative to disabled mode'
  );
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
