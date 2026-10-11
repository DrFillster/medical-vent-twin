'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const p=path.join(__dirname,'..','docs','SHIMAYOSHI_SOURCE_GRID.json');
const x=JSON.parse(fs.readFileSync(p,'utf8'));

assert.equal(x.schema,'shimayoshi-source-grid/v2');
assert.equal(x.fitTarget.includes('active cross-bridge force Fb'),true);
assert.equal(x.forbiddenTargets.includes('heart rate'),true);
assert.equal(x.forbiddenTargets.includes('MAP'),true);
assert.equal(x.activationGate.wholeHeartControlAuthority,false);
assert.equal(x.source.commit,'6478d2ab0acbfc88d3da461d2594658bcb2798ca');
assert.match(x.primaryWholeHeartBridge,/Kato\/Utaki/);
assert.deepEqual(
  x.protocols.map(v=>v.id),
  ['control','acidosis','ischemia']
);
console.log('ok - Shimayoshi extraction grid cannot fit bedside outputs');
