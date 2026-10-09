'use strict';

const {build}=require('../scripts/build-v13-run07-checkpoints.js');

let passed=0,failed=0;
function test(name,fn){try{fn();console.log('ok -',name);passed++;}catch(e){console.error('FAIL -',name,':',e.message);failed++;}}
function assert(v,m){if(!v)throw new Error(m||'assertion failed');}

test('uses asystole sample as terminal and keeps final window',()=>{
  const x=[0,1/60,2/60,3/60,4/60,5/60];
  const input={format:'lossless-numeric-extraction-of-native-SOLN',variables:{
    'System.X':x,
    'Heart-Asystole.Is_Asystole':[0,0,0,0,1,1],
    'Heart-Rate.Rate':[72,75,80,72,0,0],
    'CardiacOutput.Flow':[5,5,4,3,0,0],
  }};
  const r=build(input,2);
  assert(r.terminalIndex===4,'terminal index');
  assert(Math.abs(r.terminalSec-4)<1e-9,'terminal seconds');
  assert(r.rows.length===3,'must include t=2,3,4');
  assert(r.rows[0].sampleIndex===2&&r.rows[2].sampleIndex===4,'window endpoints');
});

test('CSV contains timestamp and available fields only',()=>{
  const input={format:'lossless-numeric-extraction-of-native-SOLN',variables:{
    'System.X':[0,1/60],
    'Heart-Asystole.Is_Asystole':[0,1],
    'Heart-Rate.Rate':[72,0],
  }};
  const r=build(input,30);
  assert(r.csv.includes('timestampSec,sampleIndex,Heart-Rate.Rate,Heart-Asystole.Is_Asystole')||
         r.csv.includes('timestampSec,sampleIndex,Heart-Rate.Rate'),
         'CSV header should expose available native fields');
  assert(!r.csv.includes('undefined'),'missing variables must not be emitted');
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
