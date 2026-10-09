'use strict';

const {
  accountSystemicOrganFlows,
  accountSystemicOrganFlowSeries,
}=require('../src/hummod_systemic_organ_flow_accounting.js');

let passed=0,failed=0;
function test(name,fn){try{fn();console.log('ok -',name);passed++;}catch(e){console.error('FAIL -',name,':',e.message);failed++;}}
function assert(v,m){if(!v)throw new Error(m||'assertion failed');}
function near(a,b,tol=1e-9){if(Math.abs(a-b)>tol)throw new Error(a+' not near '+b);}

test('accounts supplied flows without assuming cardiac output equals arterial outflow',()=>{
  const s=accountSystemicOrganFlows({
    organFlowsMlPerMin:{skeletalMuscle:1800,brain:750},
  });
  near(s.accountedFlowMlPerMin,2550);
  assert(s.referenceSystemicOutflowMlPerMin===null);
  assert(s.unresolvedFlowMlPerMin===null);
  assert(s.coverageFraction===null);
  assert(s.complete===false);
  assert(s.provenance.cardiacOutputIsNotClosureReference===true);
});

test('closes only against native SystemicArtys.Outflow when supplied',()=>{
  const s=accountSystemicOrganFlows({
    referenceSystemicOutflowMlPerMin:6000,
    organFlowsMlPerMin:{a:2500,b:2000},
  });
  near(s.unresolvedFlowMlPerMin,1500);
  near(s.coverageFraction,0.75);
  assert(s.complete===false);
});

test('rejects organ totals above native systemic arterial outflow',()=>{
  let threw=false;
  try{
    accountSystemicOrganFlows({
      referenceSystemicOutflowMlPerMin:4000,
      organFlowsMlPerMin:{a:2500,b:2000},
    });
  }catch(e){threw=/exceeds native systemic arterial outflow/.test(e.message);}
  assert(threw);
});

test('series accounting preserves arterial reservoir dynamics',()=>{
  const s=accountSystemicOrganFlowSeries({
    referenceSystemicOutflowMlPerMin:[5000,6000],
    organFlowSeriesMlPerMin:{a:[2000,2500],b:[3000,3500]},
  });
  near(s.samples[0].unresolvedFlowMlPerMin,0);
  near(s.samples[1].unresolvedFlowMlPerMin,0);
  assert(s.provenance.cardiacOutputIsNotClosureReference===true);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
