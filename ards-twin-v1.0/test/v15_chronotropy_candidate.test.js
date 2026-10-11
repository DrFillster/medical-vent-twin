'use strict';

const assert = require('node:assert/strict');
const {
  SOURCE,
  PARAMETERS,
  sympatheticStaticHeartPeriodChangeSec,
  vagalStaticHeartPeriodChangeSec,
  firstOrderExact,
  createIwamotoHeartPeriodCandidate,
} = require('../src/ursino_iwamoto_heart_period_candidate.js');

let passed=0, failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}
function close(a,b,tol=1e-12){
  return Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b));
}

test('source identity and Iwamoto Eq 26-30 parameter set are pinned',()=>{
  assert.equal(SOURCE.primary.doi,'10.1371/journal.pcbi.1012645');
  assert.deepEqual(SOURCE.primary.equations,[26,27,28,29,30]);
  assert.equal(PARAMETERS.sympatheticThresholdSpikesPerSec,2.66);
  assert.equal(PARAMETERS.sympatheticGainSec,-0.13);
  assert.equal(PARAMETERS.sympatheticTauSec,2);
  assert.equal(PARAMETERS.sympatheticDelaySec,2);
  assert.equal(PARAMETERS.baselineHeartPeriodSec,0.58);
  assert.equal(PARAMETERS.vagalGainSecPerSpikePerSec,0.09);
  assert.equal(PARAMETERS.vagalTauSec,1.5);
  assert.equal(PARAMETERS.vagalDelaySec,0.2);
});

test('Eq 26 is zero below sympathetic threshold',()=>{
  assert.equal(sympatheticStaticHeartPeriodChangeSec(0),0);
  assert.equal(sympatheticStaticHeartPeriodChangeSec(2.65),0);
});

test('Eq 26 shortens heart period above sympathetic threshold',()=>{
  const low=sympatheticStaticHeartPeriodChangeSec(3);
  const high=sympatheticStaticHeartPeriodChangeSec(10);
  assert(low<0);
  assert(high<low);
});

test('Eq 28 lengthens heart period with increasing vagal firing',()=>{
  const low=vagalStaticHeartPeriodChangeSec(1);
  const high=vagalStaticHeartPeriodChangeSec(5);
  assert(low>0);
  assert(high>low);
  assert(close(high,PARAMETERS.vagalGainSecPerSpikePerSec*5));
});

test('Eq 27/29 exact first-order update approaches target monotonically',()=>{
  const target=-0.2;
  const a=firstOrderExact(0,target,0.5,2);
  const b=firstOrderExact(a,target,0.5,2);
  assert(a<0 && a>target);
  assert(b<a && b>target);
});

test('Eq 30 produces one heart period and reciprocal HR',()=>{
  const c=createIwamotoHeartPeriodCandidate();
  const s=c.step({
    timeSec:0,
    cardiacSympatheticSpikesPerSec:2.66,
    cardiacVagalSpikesPerSec:0,
  });
  assert(close(s.heartPeriodSec,PARAMETERS.baselineHeartPeriodSec));
  assert(close(s.heartRatePerMin,60/PARAMETERS.baselineHeartPeriodSec));
  assert.equal(s.authority,'candidate-not-canonical');
});

test('higher sustained sympathetic firing increases candidate HR',()=>{
  const low=createIwamotoHeartPeriodCandidate();
  const high=createIwamotoHeartPeriodCandidate();
  let lowState, highState;
  for(let t=0;t<=20;t+=0.1){
    lowState=low.step({
      timeSec:t,
      cardiacSympatheticSpikesPerSec:3,
      cardiacVagalSpikesPerSec:2,
    });
    highState=high.step({
      timeSec:t,
      cardiacSympatheticSpikesPerSec:10,
      cardiacVagalSpikesPerSec:2,
    });
  }
  assert(highState.heartRatePerMin>lowState.heartRatePerMin);
});

test('higher sustained vagal firing decreases candidate HR',()=>{
  const low=createIwamotoHeartPeriodCandidate();
  const high=createIwamotoHeartPeriodCandidate();
  let lowState, highState;
  for(let t=0;t<=20;t+=0.1){
    lowState=low.step({
      timeSec:t,
      cardiacSympatheticSpikesPerSec:5,
      cardiacVagalSpikesPerSec:1,
    });
    highState=high.step({
      timeSec:t,
      cardiacSympatheticSpikesPerSec:5,
      cardiacVagalSpikesPerSec:5,
    });
  }
  assert(highState.heartRatePerMin<lowState.heartRatePerMin);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
