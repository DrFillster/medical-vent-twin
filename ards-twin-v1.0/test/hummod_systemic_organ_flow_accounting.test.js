'use strict';

const {
  accountSystemicOrganFlows,
  accountSystemicOrganFlowSeries,
}=require('../src/hummod_systemic_organ_flow_accounting.js');

let passed=0,failed=0;
function test(name,fn){try{fn();console.log('ok -',name);passed++;}catch(e){console.error('FAIL -',name,':',e.message);failed++;}}
function assert(v,m){if(!v)throw new Error(m||'assertion failed');}
function near(a,b,tol=1e-9){if(Math.abs(a-b)>tol)throw new Error(a+' not near '+b);}

test('accounts only supplied native organ flows and leaves residual unresolved',()=>{
  const s=accountSystemicOrganFlows({
    cardiacOutputMlPerMin:6000,
    organFlowsMlPerMin:{skeletalMuscle:1800,verifiedBrain:750},
  });
  near(s.accountedFlowMlPerMin,2550);
  near(s.unresolvedFlowMlPerMin,3450);
  near(s.coverageFraction,2550/6000);
  assert(s.complete===false);
  assert(s.residualOrganAllocation===null);
  assert(s.derivedPeripheralResistance===null);
  assert(s.provenance.residualAllocationInvented===false);
  assert(s.provenance.tprInvented===false);
});

test('marks accounting complete only when supplied native flows close cardiac output',()=>{
  const s=accountSystemicOrganFlows({
    cardiacOutputMlPerMin:5000,
    organFlowsMlPerMin:{a:1200,b:3800},
  });
  near(s.unresolvedFlowMlPerMin,0);
  assert(s.complete===true);
});

test('rejects organ-flow totals that exceed native cardiac output',()=>{
  let threw=false;
  try{
    accountSystemicOrganFlows({
      cardiacOutputMlPerMin:4000,
      organFlowsMlPerMin:{a:2500,b:2000},
    });
  }catch(e){threw=/exceeds native cardiac output/.test(e.message);}
  assert(threw,'expected overspecified native-flow accounting to fail closed');
});

test('series accounting preserves sample alignment without fitting a residual bed',()=>{
  const s=accountSystemicOrganFlowSeries({
    cardiacOutputMlPerMin:[5000,6500,8000],
    organFlowSeriesMlPerMin:{
      skeletalMuscle:[900,2000,3500],
      verifiedOther:[2600,2700,2800],
    },
  });
  assert(s.sampleCount===3);
  near(s.samples[0].unresolvedFlowMlPerMin,1500);
  near(s.samples[1].unresolvedFlowMlPerMin,1800);
  near(s.samples[2].unresolvedFlowMlPerMin,1700);
  assert(s.samples.every(x=>x.residualOrganAllocation===null));
  assert(s.samples.every(x=>x.derivedPeripheralResistance===null));
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
