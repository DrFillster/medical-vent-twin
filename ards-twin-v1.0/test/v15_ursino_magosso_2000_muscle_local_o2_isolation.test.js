'use strict';

const assert=require('node:assert/strict');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

let passed=0,failed=0,x=null;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}

test('muscle local-O2 isolation executes',()=>{
  const run=spawnSync(process.execPath,[
    path.resolve(__dirname,'../scripts/ursino-magosso-2000-muscle-local-o2-isolation.js')
  ],{encoding:'utf8',timeout:360000,maxBuffer:2*1024*1024});
  assert.equal(run.status,0,run.stderr||run.stdout);
  x=JSON.parse(run.stdout);
  assert.equal(x.measurement,'complete-ventricular-cycle means');
});

test('removing only muscle local-O2 raises early MAP response',()=>{
  assert(
    x.noMuscle.pct.map>x.source.pct.map,
    'no-muscle local-O2 MAP response must exceed source response'
  );
});

test('brain and coronary local-O2 still preserve some autoregulated redistribution',()=>{
  assert(
    x.noMuscle.pct.autoregulated>x.noMuscle.pct.remaining,
    'autoregulated flow response should remain above remaining-bed response'
  );
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
