'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const p=path.join(__dirname,'..','docs','SHIMAYOSHI_SOURCE_GRID.json');
const x=JSON.parse(fs.readFileSync(p,'utf8'));

assert.equal(x.schema,'shimayoshi-source-grid/v1');
assert.equal(x.fitTarget.includes('active cross-bridge stress'),true);
assert.equal(x.forbiddenTargets.includes('heart rate'),true);
assert.equal(x.forbiddenTargets.includes('MAP'),true);
assert.equal(x.activationGate.wholeHeartControlAuthority,false);
assert.deepEqual(
  x.protocols.map(v=>v.id),
  ['control','respiratory_acidosis','ischemia_hypoxia']
);
console.log('ok - Shimayoshi extraction grid cannot fit bedside outputs');
