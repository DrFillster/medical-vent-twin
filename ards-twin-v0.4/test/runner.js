#!/usr/bin/env node
// test/runner.js — v0.4.4 npm-test entry point.
//
// Walks the test/ directory and runs every *.js file with `node`.
// Each test file is responsible for its own assertions and exit code.
// Total pass/fail is aggregated across files.

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const testDir = path.resolve(__dirname, '..', 'test');

let totalOk = 0;
let totalFail = 0;
const failedFiles = [];

const files = fs.readdirSync(testDir).filter(f => f.endsWith('.test.js')).sort();
console.log(`Running ${files.length} test files from ${testDir}\n`);

for (const f of files) {
  const fp = path.join(testDir, f);
  const r = spawnSync(process.execPath, [fp], { encoding: 'utf8' });
  if (r.status !== 0 && r.status !== 1) {
    console.log(`[ERROR] ${f}: exited with ${r.status}`);
    console.log(r.stderr);
    continue;
  }
  const out = r.stdout + r.stderr;
  const ok = (out.match(/^ok -/gm) || []).length + (out.match(/^ok  -/gm) || []).length;
  const fail = (out.match(/^FAIL -/gm) || []).length;
  totalOk += ok;
  totalFail += fail;
  if (fail > 0) failedFiles.push(f);
  const status = fail === 0 ? '✓' : '✗';
  console.log(`  ${status} ${f.padEnd(40)} pass=${ok} fail=${fail}`);
}

console.log('');
console.log(`TOTAL: ${totalOk} passed, ${totalFail} failed`);
if (failedFiles.length > 0) {
  console.log(`FAILED: ${failedFiles.join(', ')}`);
  process.exit(1);
}
process.exit(0);
