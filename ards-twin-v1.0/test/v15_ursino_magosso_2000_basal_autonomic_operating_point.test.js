'use strict';

const assert=require('node:assert/strict');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

let passed=0,failed=0,x=null;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}

test('instantaneous basal autonomic audit executes',()=>{
  const run=spawnSync(process.execPath,[
    path.resolve(__dirname,'../scripts/ursino-magosso-2000-basal-autonomic-operating-point.js')
  ],{encoding:'utf8',timeout:300000,maxBuffer:2*1024*1024});
  assert.equal(run.status,0,run.stderr||run.stdout);
  x=JSON.parse(run.stdout);
  assert.equal(x.schema,'ursino-magosso-2000-basal-autonomic-operating-point/v2');
});

test('published basal chemoreceptor and VT coordinates are recovered',()=>{
  assert(Math.abs(
    x.basalStatic.fAc-x.publishedBasal.chemoreceptorSpikesPerSec
  )<0.05);
  assert(Math.abs(x.basalCoordinateResidual.vt)<0.01);
  assert(Math.abs(x.basalCoordinateResidual.fAc)<0.01);
  assert(Math.abs(x.basalCoordinateResidual.fAp)<0.01);
  assert(Math.abs(x.basalCoordinateResidual.thetaSp)<0.01);
  assert(Math.abs(x.basalCoordinateResidual.thetaSh)<0.01);
});

test('Eqs 21-23 close instantaneously through the pulsatile basal state',()=>{
  for(const k of ['fSp','fSh','fV']){
    assert(
      x.maxAbsInstantaneousResidual[k]<1e-10,
      k+' max residual='+x.maxAbsInstantaneousResidual[k]
    );
  }
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
