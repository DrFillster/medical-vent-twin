'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'web/index.html'),'utf8');
const app=fs.readFileSync(path.join(root,'web/app.js'),'utf8');

assert.match(
  html,
  /id="clinical-compare-myocardial-status"[^>]*>Not source-complete</
);
assert.match(
  app,
  /clinical-compare-myocardial-status/
);
assert.match(
  app,
  /myocardialContractilityStatus/
);
console.log('ok - physician UI renders categorical myocardial source-completeness status');
