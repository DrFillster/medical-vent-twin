'use strict';

const assert=require('node:assert/strict');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

let passed=0,failed=0,x=null;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}

test('basal effector mean-closure audit executes',()=>{
  const run=spawnSync(process.execPath,[
    path.resolve(__dirname,'../scripts/ursino-magosso-2000-basal-effector-mean-closure.js')
  ],{encoding:'utf8',timeout:360000,maxBuffer:2*1024*1024});
  assert.equal(run.status,0,run.stderr||run.stdout);
  x=JSON.parse(run.stdout);
  assert.equal(x.authority,'source-reproduction-diagnostic-only');
});

test('settled delayed source effectors close in the stationary mean',()=>{
  for(const k of [
    'heartPeriod','EmaxLv','EmaxRv','Rsp','Rep','Vusv','Vuev','Vumv'
  ]){
    assert(
      Math.abs(x.percentResidual[k])<0.5,
      k+' mean residual='+x.percentResidual[k]+'%'
    );
  }
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
