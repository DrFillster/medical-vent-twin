'use strict';

const assert=require('node:assert/strict');
const artifact=require('../artifacts/v1.5/SHIMAYOSHI_ACIDOSIS_GRID_TABLE_V3.json');
const {
  SHIMAYOSHI_ACIDOSIS_GRID_TABLE_V3,
}=require('../src/shimayoshi_acidosis_grid_data.js');

assert.deepEqual(SHIMAYOSHI_ACIDOSIS_GRID_TABLE_V3,artifact);
assert.equal(SHIMAYOSHI_ACIDOSIS_GRID_TABLE_V3.closedLoopAuthority,false);
assert.equal(SHIMAYOSHI_ACIDOSIS_GRID_TABLE_V3.controlAuthority,false);
console.log('ok - browser-native Shimayoshi acidosis grid exactly matches validated artifact');
