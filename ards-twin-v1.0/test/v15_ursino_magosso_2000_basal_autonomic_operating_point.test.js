'use strict';

const assert=require('node:assert/strict');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

let passed=0,failed=0,x=null;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}

test('basal autonomic operating-point audit executes',()=>{
  const run=spawnSync(process.execPath,[
    path.resolve(__dirname,'../scripts/ursino-magosso-2000-basal-autonomic-operating-point.js')
  ],{encoding:'utf8',timeout:300000,maxBuffer:2*1024*1024});
  assert.equal(run.status,0,run.stderr||run.stdout);
  x=JSON.parse(run.stdout);
  assert.equal(x.authority,'source-reproduction-diagnostic-only');
});

test('published basal chemoreceptor and VT coordinates are recovered',()=>{
  assert(Math.abs(
    x.expectedAfferents.fAc-x.publishedBasal.chemoreceptorSpikesPerSec
  )<0.05);
  assert(Math.abs(
    x.settled.vt-x.publishedBasal.tidalVolumeL
  )<0.01);
});

test('settled autonomic outputs match the source static equations at settled inputs',()=>{
  for(const k of ['fSp','fSh','fV']){
    assert(
      Math.abs(x.residuals[k])<0.02,
      k+' residual='+x.residuals[k]
    );
  }
});

test('settled delayed effectors match source steady targets',()=>{
  for(const k of [
    'heartPeriod','EmaxLv','EmaxRv','Rsp','Rep','Vusv','Vuev','Vumv'
  ]){
    assert(
      Math.abs(x.residuals[k])<0.02,
      k+' residual='+x.residuals[k]
    );
  }
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
