'use strict';

const {
  createHumModRunRequest,
} = require('../src/hummod_runner_contract.js');
const {
  HUMMOD_REMOTE_REQUEST_SCHEMA,
  generateHumModRemoteRequest,
  xmlEscape,
} = require('../src/hummod_remote_request.js');

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

test('candidate remote request includes System.X and verified roster', () => {
  const r = generateHumModRemoteRequest({
    runRequest: request(),
    outputFile: 'C:\\VentHumMod\\output.txt',
    logFile: 'C:\\VentHumMod\\done.log',
  });
  assert(r.schema === HUMMOD_REMOTE_REQUEST_SCHEMA);
  assert(r.runtimeVerified === false);
  assert(r.roster[0] === 'System.X');
  assert(r.roster.includes('PO2Artys.Pressure'));
  assert(r.roster.includes('CardiacOutput.Flow(L/Min)'));
});

test('candidate request uses documented scripted tracking tasks', () => {
  const r = generateHumModRemoteRequest({
    runRequest: request(),
    outputFile: 'out.txt',
    logFile: 'done.log',
  });
  const xml = r.xml;
  for (const tag of [
    '<remoterequest>', '<scripted>', '<fileroster>',
    '<filestarttracking/>', '<advancefor>', '<filestoptracking/>',
    '<fileupdate/>', '<fileclose/>', '<remote>', '<logfile>done.log</logfile>'
  ]) assert(xml.includes(tag), 'missing ' + tag);
  assert(xml.includes('<solutionint>5</solutionint>'));
  assert(xml.includes('<displayint>0.08333333333333333</displayint>'));
});

test('XML text fields are escaped', () => {
  assert(xmlEscape('a&b<c>\"d\'e') === 'a&amp;b&lt;c&gt;&quot;d&apos;e');
});

test('generator rejects non-run-request input', () => {
  let threw = false;
  try { generateHumModRemoteRequest({ runRequest: {}, outputFile: 'a', logFile: 'b' }); }
  catch (_) { threw = true; }
  assert(threw);
});

console.log('\nTests: passed=' + passed + ' failed=' + failed);
process.exit(failed === 0 ? 0 : 1);
