'use strict';

const {
  createV24TerminalStateController,
  MAP30_SEC,
  MAP20_SEC,
}=require('../src/v24_terminal_state_controller.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}
function assert(c,m){if(!c)throw new Error(m||'assertion failed');}

test('oxygen debt alone never triggers arrest',()=>{
  const t=createV24TerminalStateController();
  let s;
  for(let i=0;i<3600;i++) s=t.step({
    dtSec:1,
    meanArterialPressureMmHg:70,
    cardiacOutputMlPerMin:4000,
    mechanicalPumpFailure:false,
    oxygenDeficit:{
      supplyDependent:true,
      cumulativeOxygenDeficitMl:10000+i,
      cumulativeFractionalDeficitMin:50,
    },
  });
  assert(s.cardiacArrest===false);
  assert(s.oxygenDebtDeathThresholdUsed===false);
  assert(s.elapsedAsphyxiaTimerUsed===false);
});

test('mechanical pump failure causes immediate nonperfusing terminal state',()=>{
  const t=createV24TerminalStateController();
  const s=t.step({
    dtSec:0.1,
    meanArterialPressureMmHg:40,
    cardiacOutputMlPerMin:0,
    mechanicalPumpFailure:true,
  });
  assert(s.cardiacArrest===true);
  assert(s.cardiacArrestReason==='mechanical-pump-failure');
  assert(s.arrestRhythm==='PEA');
});

test('published sustained profound hypotension criteria trigger arrest',()=>{
  const a=createV24TerminalStateController();
  let s;
  for(let i=0;i<MAP20_SEC;i++) s=a.step({
    dtSec:1,
    meanArterialPressureMmHg:15,
    cardiacOutputMlPerMin:500,
  });
  assert(s.cardiacArrest===true);
  assert(s.cardiacArrestReason==='sustained-map-below-20');

  const b=createV24TerminalStateController();
  for(let i=0;i<MAP30_SEC;i++) s=b.step({
    dtSec:1,
    meanArterialPressureMmHg:25,
    cardiacOutputMlPerMin:1000,
  });
  assert(s.cardiacArrest===true);
  assert(s.cardiacArrestReason==='sustained-map-below-30');
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
