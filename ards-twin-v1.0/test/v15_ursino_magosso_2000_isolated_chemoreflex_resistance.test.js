'use strict';

const assert=require('node:assert/strict');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}
let x;

test('isolated chemoreflex diagnostic executes with competing mechanisms held',()=>{
  const run=spawnSync(process.execPath,[
    path.resolve(__dirname,'../scripts/ursino-magosso-2000-isolated-chemoreflex-resistance.js')
  ],{encoding:'utf8',timeout:30000,maxBuffer:1024*1024});
  assert.equal(run.status,0,run.stderr||run.stdout);
  x=JSON.parse(run.stdout);
  assert.equal(x.authority,'diagnostic-source-component-only');
  assert.equal(x.held.cnsHypoxiaHeldAtNormoxic,true);
  assert.equal(x.held.localHypoxicVasodilationDisabled,true);
});

test('deep hypoxia activates peripheral chemoreceptor and vascular sympathetic arm',()=>{
  assert(x.deep.fAcSpikesPerSec>x.baseline.fAcSpikesPerSec);
  assert(x.deep.fSpSpikesPerSec>x.baseline.fSpSpikesPerSec);
  assert(x.deep.totalPeripheralResistanceMmHgSecPerMl>
         x.baseline.totalPeripheralResistanceMmHgSecPerMl);
});

// Do not tune to this range. Failure means source-component reproduction is
// incomplete and must be audited from equations/experimental setup.
test('isolated chemoreflex total-resistance response reaches source target range',()=>{
  assert(
    x.percentChange>=55&&x.percentChange<=75,
    'expected approximately 60-70% source response; got '+x.percentChange+'%'
  );
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
