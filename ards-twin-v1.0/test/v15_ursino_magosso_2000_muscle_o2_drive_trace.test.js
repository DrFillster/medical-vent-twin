'use strict';

const assert=require('node:assert/strict');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

let passed=0,failed=0,x=null;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}

test('muscle O2 drive trace executes',()=>{
  const run=spawnSync(process.execPath,[
    path.resolve(__dirname,'../scripts/ursino-magosso-2000-muscle-o2-drive-trace.js')
  ],{encoding:'utf8',timeout:240000,maxBuffer:2*1024*1024});
  assert.equal(run.status,0,run.stderr||run.stdout);
  x=JSON.parse(run.stdout);
  assert.equal(x.authority,'diagnostic-source-equation-audit-only');
});

test('Eq42 multiplicative muscle resistance identity remains exact',()=>{
  assert(x.maxAbsEq42Residual<1e-10,'Eq42 residual '+x.maxAbsEq42Residual);
});

test('muscle O2 state remains finite through deep hypoxia',()=>{
  for(const r of [x.baseline,...x.seconds]){
    for(const k of [
      'arterialO2MlPerMl','muscleVenousO2MlPerMl','muscleTarget',
      'muscleLocalState','muscleReflexNormalResistance','muscleFinalResistance',
    ]) assert(Number.isFinite(r[k]),k);
  }
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
