'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const app=fs.readFileSync(path.join(__dirname,'../web/app.js'),'utf8');
const start=app.indexOf('  function requirePhysicianCandidateSnapshot(snapshot)');
const end=app.indexOf('\n  async function pollNativeEngineBoundary',start);
assert(start>=0&&end>start,'snapshot validator must exist');
const validate=vm.runInNewContext('('+app.slice(start,end).trim()+')');
const keys=['heartRatePerMin','meanArterialPressureMmHg','cardiacOutputMlPerMin',
  'strokeVolumeMl','systemicPeripheralResistanceMmHgMinPerL'];
function snapshot(candidate){return {
  sessionSchema:'berlin-clinical-twin-live-hummod-session/v1',
  systemic:{physicianComparison:{candidateModel:candidate,
    hummod2013Compensation:{heartRatePerMin:80}}},
};}
let passed=0,failed=0;
function test(name,fn){try{fn();passed++;console.log('ok - '+name);}
catch(e){failed++;console.error('FAIL - '+name+': '+e.message);}}
test('absent and unexplained invalid comparison data still fail closed',()=>{
  assert.throws(()=>validate(snapshot(null)),/candidate missing/);
  for(const key of keys){
    const c=Object.fromEntries(keys.map(k=>[k,80]));c[key]=null;
    assert.throws(()=>validate(snapshot(c)),new RegExp('invalid '+key));
  }
});
test('documented source-domain stop carries nulls and does not masquerade as a pass',()=>{
  const c={...Object.fromEntries(keys.map(k=>[k,null])),available:false,
    validationStatus:'blocked-source-domain',controlAuthority:false,
    unavailableReason:'venousO2MlPerMl must be >= 0'};
  assert.doesNotThrow(()=>validate(snapshot(c)));
  assert.throws(()=>validate(snapshot({...c,heartRatePerMin:80})),/must not publish current/);
  assert.throws(()=>validate(snapshot({...c,unavailableReason:null})),/invalid heartRate/);
  assert.throws(()=>validate(snapshot({...c,controlAuthority:true})),/invalid heartRate/);
  const s=snapshot(c);s.systemic.physicianComparison.hummod2013Compensation=null;
  assert.throws(()=>validate(s),/HumMod 2013 compensation comparison missing or invalid/);
});
console.log(`Tests: passed=${passed} failed=${failed}`);process.exitCode=failed?1:0;
