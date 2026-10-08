'use strict';
const {
  CELL_SID_STRONG_ANIONS,
  CELL_SID_OTHER_CATIONS,
  cellSidLessLactate,
  myocardialSid,
}=require('../src/hummod_myocardial_sid_source_aligned.js');

let passed=0,failed=0;
function test(name,fn){try{fn();console.log('ok -',name);passed++;}catch(e){console.error('FAIL -',name,':',e.message);failed++;}}
function assert(v,m){if(!v)throw new Error(m||'assertion failed');}
function near(a,b,tol=1e-12){assert(Math.abs(a-b)<=tol,a+' not near '+b);}

test('preserves CellSID source constants',()=>{
  near(CELL_SID_STRONG_ANIONS,0.117);
  near(CELL_SID_OTHER_CATIONS,0.012);
});

test('CellSID LessLac matches source relation',()=>{
  near(cellSidLessLactate({intracellularPotassium:0.142}),0.142+0.012-0.117);
});

test('myocardial SID subtracts local lactate',()=>{
  const s=myocardialSid({intracellularPotassium:0.142,myocardialLactate:0.005});
  near(s.sid,(0.142+0.012-0.117)-0.005);
  near(s.sidMeqPerL,1000*s.sid);
});

test('higher myocardial lactate lowers SID one-for-one',()=>{
  const a=myocardialSid({intracellularPotassium:0.142,myocardialLactate:0.001});
  const b=myocardialSid({intracellularPotassium:0.142,myocardialLactate:0.011});
  near(a.sid-b.sid,0.010);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
