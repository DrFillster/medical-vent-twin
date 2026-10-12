'use strict';

const assert=require('node:assert/strict');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}

let audit=null;

test('Fig9 sensitivity challenge executes as non-canonical source audit',()=>{
  const script=path.resolve(
    __dirname,'../scripts/ursino-1998-fig9-sensitivity.js'
  );
  const run=spawnSync(process.execPath,[script],{
    encoding:'utf8',
    timeout:120000,
    maxBuffer:4*1024*1024,
  });
  assert.equal(run.status,0,run.stderr||run.stdout);
  audit=JSON.parse(run.stdout);
  assert.equal(audit.schema,'ursino-1998-fig9-effector-sensitivity/v1');
  assert.equal(audit.authority,'candidate-not-canonical');
  assert.match(audit.acceptance.quantitative,/UNASSESSED/);
});

test('each disabled-effector case preserves the same basal hemodynamic state',()=>{
  assert(audit);
  const intact=audit.results.intact.baseline;
  for(const name of [
    'noVenousUnstressedVolume','noPeripheralResistance',
    'noHeartPeriod','noEmax',
  ]){
    const b=audit.results[name].baseline;
    for(const key of [
      'sapMmHg','cardiacOutputMlPerSec',
      'peripheralResistanceMmHgSecPerMl','hrPerMin',
    ]){
      assert(
        Math.abs(b[key]-intact[key])<1e-9,
        name+' baseline drifted for '+key
      );
    }
  }
});

test('venous unstressed-volume control has the largest added SAP and CO protection',()=>{
  assert(audit);
  for(const key of [
    'sapAddedDeteriorationPercentagePoints',
    'coAddedDeteriorationPercentagePoints',
  ]){
    const o=audit.ordering[key];
    assert(
      o.noVenousUnstressedVolume>o.noPeripheralResistance,
      key+': venous effect must exceed resistance effect'
    );
    assert(
      o.noVenousUnstressedVolume>o.noHeartPeriod,
      key+': venous effect must exceed heart-period effect'
    );
    assert(
      o.noVenousUnstressedVolume>o.noEmax,
      key+': venous effect must exceed Emax effect'
    );
  }
});

test('Emax removal has the smallest SAP and CO effect magnitude',()=>{
  assert(audit);
  for(const key of [
    'sapAbsoluteEffectPercentagePoints',
    'coAbsoluteEffectPercentagePoints',
  ]){
    const o=audit.ordering[key];
    assert(o.noEmax<o.noPeripheralResistance);
    assert(o.noEmax<o.noHeartPeriod);
    assert(o.noEmax<o.noVenousUnstressedVolume);
  }
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
