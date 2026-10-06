#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
function classify(result) {
  const output = (result.stdout || '') + (result.stderr || '');
  const passed = (output.match(/^ok\s+-/gm) || []).length;
  const failed = (output.match(/^FAIL\s+-/gm) || []).length;
  return { passed, failed, broken: !!result.error || !!result.signal || result.status !== 0 || failed > 0 || passed === 0, output };
}
function main(directory = __dirname) {
  const files = fs.readdirSync(directory).filter(f => f.endsWith('.test.js')).sort();
  const results = [];
  for (const file of files) {
    const child = spawnSync(process.execPath, [path.join(directory, file)], { encoding: 'utf8', timeout: 120000, maxBuffer: 4 * 1024 * 1024 });
    const result = classify(child);
    results.push({ file, passed: result.passed, failed: result.failed, status: result.broken ? 'failed' : 'passed' });
    console.log(`${result.broken ? 'FAIL' : 'PASS'} ${file}: ${result.passed} passed, ${result.failed} failed`);
    if (result.broken) console.error(child.error?.message || result.output || `Exit: ${child.status}, signal: ${child.signal}`);
  }
  const report = { version: '0.4.5', runtime: process.version, date: new Date().toISOString(),
    files: results, passed: results.reduce((s, r) => s + r.passed, 0), failed: results.reduce((s, r) => s + r.failed, 0),
    failedFiles: results.filter(r => r.status === 'failed').map(r => r.file) };
  report.success = files.length > 0 && report.failedFiles.length === 0;
  if (directory === __dirname) fs.writeFileSync(path.join(__dirname, '../TEST_RESULTS.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`TOTAL: ${report.passed} passed, ${report.failed} assertion failures; ${report.failedFiles.length} failed files`);
  return report.success ? 0 : 1;
}
if (require.main === module) process.exitCode = main(process.argv[2] ? path.resolve(process.argv[2]) : __dirname);
module.exports = { classify, main };
