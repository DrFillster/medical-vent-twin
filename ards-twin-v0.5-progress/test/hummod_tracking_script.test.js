'use strict';

const {
  createHumModRunRequest,
} = require('../src/hummod_runner_contract.js');
const {
  TRACKING_SCRIPT_SCHEMA,
  secondsToHumModMinutes,
  createHumModTrackingScript,
} = require('../src/hummod_tracking_script.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log('ok -', name); passed += 1; }
  catch (e) { console.error('FAIL -', name, ':', e.message); failed += 1; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

function request() {
  return createHumModRunRequest({
    trajectoryId: 'moderate-aspiration-reference-001',
    durationSec: 300,
    sampleIntervalSec: 5,
    scenarioId: 'berlin-moderate-moderate-aspiration',
  });
}

test('seconds convert to pinned HumMod minutes', () => {
  assert(secondsToHumModMinutes(60) === 1);
  assert(secondsToHumModMinutes(300) === 5);
});

test('tracking script includes System.X and exact verified requested symbols', () => {
  const req = request();
  const out = createHumModTrackingScript(req);
  assert(out.schema === TRACKING_SCRIPT_SCHEMA);
  assert(out.variables[0] === 'System.X');
  for (const symbol of req.requestedOutput.symbols) {
    assert(out.variables.includes(symbol), 'missing symbol ' + symbol);
    assert(out.script.includes('<name>' + symbol + '</name>'));
  }
  assert(out.script.includes('<name>System.X</name>'));
});

test('tracking script uses documented file tracking and requested cadence', () => {
  const out = createHumModTrackingScript(request(), { outputFilename: 'reference.dat' });
  assert(out.outputFilename === 'reference.dat');
  assert(out.script.includes('<fileopencreate>reference.dat</fileopencreate>'));
  assert(out.script.includes('<fileroster>'));
  assert(out.script.includes('<filewriteheader/>'));
  assert(out.script.includes('<filestarttracking/>'));
  assert(out.script.includes('<solutionint>5</solutionint>'));
  assert(out.script.includes('<displayint>0.083333333333</displayint>'));
  assert(out.script.includes('<storageint>0.083333333333</storageint>'));
  assert(out.script.includes('<filestoptracking/>'));
  assert(out.script.includes('<fileclose/>'));
  assert(out.parserStatus === 'awaiting-real-runtime-output-sample');
});

test('unsafe output filenames are rejected', () => {
  let threw = false;
  try { createHumModTrackingScript(request(), { outputFilename: '../escape.dat' }); }
  catch (_) { threw = true; }
  assert(threw);
});

console.log('\nTests: passed=' + passed + ' failed=' + failed);
process.exit(failed === 0 ? 0 : 1);
