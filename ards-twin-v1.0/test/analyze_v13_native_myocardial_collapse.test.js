'use strict';

const { analyze }=require('../scripts/analyze-v13-native-myocardial-collapse.js');

let passed=0,failed=0;
function test(name,fn){try{fn();console.log('ok -',name);passed++;}catch(e){console.error('FAIL -',name,':',e.message);failed++;}}
function assert(v,m){if(!v)throw new Error(m||'assertion failed');}

function fixture(){
  const t=[0,1,2];
  const make=(a,b,c)=>[a,b,c];
  return {format:'lossless-numeric-extraction-of-native-SOLN',clockUnit:'minutes',variables:{
    'System.X':t,
    'Heart-Rate.Rate':make(70,80,0),
    'CardiacOutput.Flow':make(5000,5500,0),
    'SANode-Rate.Rate':make(70,80,72),
    'SANode-Rate.Is_SinusRhythm':make(1,1,0),
    'Heart-Asystole.Is_Asystole':make(0,0,1),
    'LeftHeart-CO2.PCO2':make(55,60,65),'RightHeart-CO2.PCO2':make(56,61,66),
    'LeftHeart-Lactate.[Lac-]':make(.001,.02,.03),'RightHeart-Lactate.[Lac-]':make(.001,.025,.035),
    'LeftHeart-Ph.[SID]':make(.045,.025,.018),'RightHeart-Ph.[SID]':make(.045,.02,.012),
    'LeftHeart-Ph.Ph':make(7.05,6.76,6.61),'RightHeart-Ph.Ph':make(7.03,6.66,6.43),
    'LeftHeart-Function.PhEffect':make(1,1,.04),'RightHeart-Function.PhEffect':make(1,.7,0),
    'LeftHeart-Function.Effect':make(1,.99,.04),'RightHeart-Function.Effect':make(1,.68,0),
    'LeftHeart-Function.Failed':make(0,0,1),'RightHeart-Function.Failed':make(0,0,1),
  }};
}

test('identifies native asystole terminal sample and preserved SA-node rate',()=>{
  const r=analyze(fixture());
  assert(r.terminalIndex===2);
  assert(r.sourceMechanismChecks.leftFailureAndAsystoleSameSample===true);
  assert(r.sourceMechanismChecks.rhythmAndPumpLossSameTerminalSample===true);
  assert(r.sourceMechanismChecks.saNodeRateAtTerminal===72);
  assert(r.sourceMechanismChecks.actualHeartRateAtTerminal===0);
});

test('does not claim causality from sparse ordering',()=>{
  const r=analyze(fixture());
  assert(r.interpretation.causalityEstablished===false);
  assert(/sparse/.test(r.interpretation.reason));
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
