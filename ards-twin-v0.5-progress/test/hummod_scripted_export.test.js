'use strict';

const {
  HUMMOD_SCRIPT_REQUEST_SCHEMA,
  createHumModScriptedExportRequest,
  defaultHumModScriptedExportRequest,
} = require('../src/hummod_scripted_export.js');
const {
  HUMMOD_SOURCE_CLOCK,
} = require('../src/hummod_runner_contract.js');
const {
  HUMMOD_STANDALONE_UPSTREAM,
  listVerifiedDirectMappings,
} = require('../src/hummod_standalone_manifest.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log('ok -', name); passed += 1; }
  catch (e) { console.error('FAIL -', name, ':', e.message); failed += 1; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

test('default scripted request pins source and all verified direct symbols', () => {
  const r = defaultHumModScriptedExportRequest({
    trajectoryId: 'moderate-aspiration-real-001',
    durationSec: 300,
    sampleIntervalSec: 5,
    scenarioId: 'berlin-moderate-moderate-aspiration',
  });
  assert(r.schema === HUMMOD_SCRIPT_REQUEST_SCHEMA);
  assert(r.source.repository === HUMMOD_STANDALONE_UPSTREAM.repository);
  assert(r.source.revision === HUMMOD_STANDALONE_UPSTREAM.revision);
  assert(r.clock.symbol === 'System.X');
  assert(r.clock.unit === 'minute');
  assert(r.requestedSymbols.length === listVerifiedDirectMappings().length);
  assert(r.roster[0] === 'System.X');
});

test('Vent seconds are converted to HumMod minute intervals', () => {
  const r = defaultHumModScriptedExportRequest({
    trajectoryId: 'x',
    durationSec: 300,
    sampleIntervalSec: 5,
  });
  assert(r.durationHumModMinutes === 5);
  assert(Math.abs(r.sampleIntervalHumModMinutes - (5 / 60)) < 1e-12);
  assert(r.requestXml.includes('<solutionint>5</solutionint>'));
  assert(r.requestXml.includes('<displayint>0.0833333333333333</displayint>'));
});

test('request uses documented file tracking and completion-log elements', () => {
  const r = defaultHumModScriptedExportRequest({
    trajectoryId: 'x',
    durationSec: 60,
    sampleIntervalSec: 5,
  });
  for (const token of [
    '<remoterequest>',
    '<scripted>',
    '<fileopencreate>VentHumModTrajectory.DAT</fileopencreate>',
    '<fileroster>',
    '<name>System.X</name>',
    '<filewriteheader/>',
    '<fileupdate/>',
    '<filestarttracking/>',
    '<advancefor>',
    '<filestoptracking/>',
    '<fileclose/>',
    '<remote>',
    '<logfile>VentHumModTrajectory.LOG</logfile>',
  ]) {
    assert(r.requestXml.includes(token), 'missing XML token: ' + token);
  }
});

test('request contains exact verified HumMod symbols and no pending mappings', () => {
  const r = defaultHumModScriptedExportRequest({
    trajectoryId: 'x',
    durationSec: 60,
    sampleIntervalSec: 5,
  });
  for (const mapping of listVerifiedDirectMappings()) {
    assert(r.requestXml.includes('<name>' + mapping.symbol + '</name>'));
  }
  assert(!r.requestXml.includes('RightAtrium.Pressure'));
});

test('unsafe output filenames are rejected', () => {
  let threwPath = false;
  try {
    defaultHumModScriptedExportRequest({
      trajectoryId: 'x',
      durationSec: 60,
      sampleIntervalSec: 5,
      dataFilename: '../escape.dat',
    });
  } catch (_) { threwPath = true; }
  assert(threwPath);

  let threwSame = false;
  try {
    defaultHumModScriptedExportRequest({
      trajectoryId: 'x',
      durationSec: 60,
      sampleIntervalSec: 5,
      dataFilename: 'same.dat',
      logFilename: 'same.dat',
    });
  } catch (_) { threwSame = true; }
  assert(threwSame);
});

console.log('\nTests: passed=' + passed + ' failed=' + failed);
process.exit(failed === 0 ? 0 : 1);
