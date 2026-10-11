'use strict';

const assert=require('node:assert/strict');
const sourceGridTable=require('../artifacts/v1.5/SHIMAYOSHI_ACIDOSIS_GRID_TABLE_V3.json');
const {
  createFixedStepShimayoshiAcidosisHistoryGate,
}=require('../src/shimayoshi_acidosis_history_gate.js');

const gate=createFixedStepShimayoshiAcidosisHistoryGate({sourceGridTable});

const first=gate.evaluate({
  myocardialPco2MmHg:118.5,
  sourceProtocolTimeS:400,
  phase:'challenge',
});
assert.equal(first.fixedStepHistorySupported,true);
assert(first.sourcePrediction);
assert.equal(first.closedLoopAuthority,false);

const same=gate.evaluate({
  myocardialPco2MmHg:118.7,
  sourceProtocolTimeS:500,
  phase:'challenge',
});
assert.equal(same.fixedStepHistorySupported,true);

const changed=gate.evaluate({
  myocardialPco2MmHg:197.5,
  sourceProtocolTimeS:600,
  phase:'challenge',
});
assert.equal(changed.fixedStepHistorySupported,false);
assert.equal(changed.sourcePrediction,null);
assert.match(changed.status,/dynamic-myocardial-CO2-history/);
assert.equal(changed.closedLoopAuthority,false);
console.log('ok - changing myocardial CO2 during challenge fails closed');

const stillBlocked=gate.evaluate({
  myocardialPco2MmHg:118.5,
  sourceProtocolTimeS:700,
  phase:'challenge',
});
assert.equal(stillBlocked.fixedStepHistorySupported,false);

const reset=gate.evaluate({
  myocardialPco2MmHg:40,
  sourceProtocolTimeS:0,
  phase:'control',
});
assert.equal(reset.fixedStepHistorySupported,true);

const newChallenge=gate.evaluate({
  myocardialPco2MmHg:158,
  sourceProtocolTimeS:400,
  phase:'challenge',
});
assert.equal(newChallenge.fixedStepHistorySupported,true);
assert(newChallenge.sourcePrediction);
console.log('ok - control reset permits a new independently validated fixed-step challenge');
