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

test('basal flow allocation audit executes',()=>{
  const run=spawnSync(process.execPath,[
    path.resolve(__dirname,'../scripts/ursino-magosso-2000-basal-flow-allocation-audit.js')
  ],{encoding:'utf8',timeout:240000,maxBuffer:4*1024*1024});
  assert.equal(run.status,0,run.stderr||run.stdout);
  x=JSON.parse(run.stdout);
  assert.equal(x.authority,'source-reproduction-diagnostic-only');
});

test('brain basal fraction matches source 14-15 percent allocation',()=>{
  const v=x.actual.fractions.brain;
  assert(v>=0.14&&v<=0.15,'brain fraction='+v);
});

test('coronary basal fraction matches source 4-5 percent allocation',()=>{
  const v=x.actual.fractions.coronary;
  assert(v>=0.04&&v<=0.05,'coronary fraction='+v);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
