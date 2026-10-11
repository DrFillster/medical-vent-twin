'use strict';

const assert=require('node:assert/strict');
const table=require('../artifacts/v1.5/SHIMAYOSHI_ACIDOSIS_GRID_TABLE_V3.json');
const {
  createAcidosisGridSurrogateFromTable,
}=require('../src/shimayoshi_acidosis_grid_surrogate.js');

assert.equal(table.schema,'shimayoshi-acidosis-grid-table/v3');
assert.equal(
  table.upstreamGitSha,
  '6478d2ab0acbfc88d3da461d2594658bcb2798ca'
);
assert.deepEqual(
  table.levels.map(x=>x.sourceChallengeCo2Percent),
  [5,10,15,20,25,30]
);
assert.equal(table.closedLoopAuthority,false);
assert.equal(table.controlAuthority,false);
assert.equal(
  table.timeCompression.maxAbsoluteStressRatioErrorPerSourceLevel,
  0.0002
);

for(const level of table.levels){
  const times=level.keyframes.map(x=>x[0]);
  assert(times.includes(299.6));
  assert(times.includes(300));
  assert(times.includes(899.6));
  assert(times.includes(900));
}

const surrogate=createAcidosisGridSurrogateFromTable(table);

const controlEquivalent=surrogate.evaluate({
  sourceChallengeCo2Percent:5,
  sourceTimeS:600,
});
assert(Math.abs(controlEquivalent.stressRatio-1)<2e-5);
assert.equal(controlEquivalent.closedLoopAuthority,false);

const severe=surrogate.evaluate({
  sourceChallengeCo2Percent:30,
  sourceTimeS:401.2,
});
assert(severe.stressRatio<0.875);
assert(severe.stressRatio>0.871);

const intermediate=surrogate.evaluate({
  sourceChallengeCo2Percent:12.5,
  sourceTimeS:450,
});
assert(Number.isFinite(intermediate.stressRatio));
assert.equal(intermediate.interpolatedChallenge,true);
assert.equal(intermediate.closedLoopAuthority,false);

assert.throws(
  ()=>surrogate.evaluate({
    sourceChallengeCo2Percent:4.9,
    sourceTimeS:450,
  }),
  /outside validated source grid/
);
assert.throws(
  ()=>surrogate.evaluate({
    sourceChallengeCo2Percent:30.1,
    sourceTimeS:450,
  }),
  /outside validated source grid/
);
assert.throws(
  ()=>surrogate.evaluate({
    sourceChallengeCo2Percent:20,
    sourceTimeS:961,
  }),
  /outside validated source trajectory/
);

console.log(
  'ok - committed Shimayoshi acidosis table loads with source boundaries and fail-closed domain'
);
