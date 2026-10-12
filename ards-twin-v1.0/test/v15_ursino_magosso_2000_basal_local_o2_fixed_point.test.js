'use strict';

const assert=require('node:assert/strict');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

let passed=0,failed=0,x=null;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}

test('basal local-O2 fixed-point audit executes',()=>{
  const run=spawnSync(process.execPath,[
    path.resolve(__dirname,'../scripts/ursino-magosso-2000-basal-local-o2-fixed-point.js')
  ],{encoding:'utf8',timeout:300000,maxBuffer:2*1024*1024});
  assert.equal(run.status,0,run.stderr||run.stdout);
  x=JSON.parse(run.stdout);
  assert.equal(x.authority,'source-reproduction-diagnostic-only');
});

test('settled source-basal local-O2 states are within 1 percent of nominal venous O2',()=>{
  for(const bed of ['brain','heart','muscle']){
    const d=Math.abs(x.beds[bed].venousO2PercentDifference);
    assert(
      d<1,
      bed+' venous O2 differs from source-normal by '+d+'%'
    );
  }
});

test('settled source-basal Eq43 flows are within 1 percent of fixed-point requirement',()=>{
  for(const bed of ['brain','heart','muscle']){
    const ratio=x.beds[bed].actualToImpliedActualConsumptionFlowRatio;
    assert(
      Math.abs(ratio-1)<0.01,
      bed+' actual/implied flow ratio='+ratio
    );
  }
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
