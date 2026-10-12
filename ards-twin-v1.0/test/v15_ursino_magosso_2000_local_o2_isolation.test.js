'use strict';

const assert=require('node:assert/strict');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

let passed=0,failed=0,x=null;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}

test('local-O2 isolation diagnostic executes',()=>{
  const run=spawnSync(process.execPath,[
    path.resolve(__dirname,'../scripts/ursino-magosso-2000-local-o2-isolation.js')
  ],{encoding:'utf8',timeout:180000,maxBuffer:2*1024*1024});
  assert.equal(run.status,0,run.stderr||run.stdout);
  x=JSON.parse(run.stdout);
  assert.equal(x.authority,'diagnostic-source-component-only');
});

test('default source mode retains local-O2 control and expected early mismatch',()=>{
  assert.equal(x.source.mode,'source');
  assert(x.source.pct.hr<0);
  assert(Math.abs(x.source.pct.co)<5);
});

test('disabling local-O2 control increases early arterial pressure response',()=>{
  assert.equal(x.disabled.mode,'disabled');
  assert(
    x.disabled.pct.map>x.source.pct.map,
    'local-O2-disabled MAP response must exceed source-mode MAP response'
  );
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
