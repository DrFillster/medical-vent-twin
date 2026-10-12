'use strict';

const assert=require('assert');
const path=require('path');
const {spawnSync}=require('child_process');

function run(args=[]){
  return spawnSync(process.execPath,[
    path.resolve(__dirname,'../scripts/summarize-physiology-registry.js'),
    ...args,
  ],{encoding:'utf8'});
}

const normal=run();
assert.strictEqual(normal.status,0,normal.stderr);
const summary=JSON.parse(normal.stdout);
assert.strictEqual(summary.schema,'medical-vent-twin/physiology-registry-summary/v1');
assert.ok(summary.counts.equations>0);
assert.ok(summary.counts.variables>0);
console.log('ok - registry summary is readable and nonempty');

const exact=run(['--exact']);
assert.notStrictEqual(exact.status,0);
assert.match(
  String(exact.stderr),
  /Exact totals are fail-closed until physiology registry completeness=COMPLETE/
);
console.log('ok - exact totals fail closed while registry is partial');
