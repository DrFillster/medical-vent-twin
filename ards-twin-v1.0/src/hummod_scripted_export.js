'use strict';

// hummod_scripted_export.js
//
// Generates a HumMod remote-request script using only documented control
// elements from HumMod's scripted/remote schema. This does not execute HumMod.
//
// Output intent:
// - create one data file
// - roster System.X + Vent-approved direct HumMod source symbols
// - write an initial sample
// - track samples at the requested display interval
// - advance for the requested duration
// - stop/close output
// - request a completion log file
//
// HumMod's independent variable System.X is minutes for the pinned source.
// Vent-facing request cadence remains seconds and is converted here.

const {
  HUMMOD_STANDALONE_UPSTREAM,
  listVerifiedDirectMappings,
} = require('./hummod_standalone_manifest.js');
const {
  HUMMOD_SOURCE_CLOCK,
  createHumModRunRequest,
} = require('./hummod_runner_contract.js');

const HUMMOD_SCRIPT_REQUEST_SCHEMA = 'vent-hummod-script-request/v1';

function safeFilename(value, label) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9._-]+$/.test(value)) {
    throw new Error(label + ' must contain only letters, numbers, dot, underscore, or hyphen');
  }
  return value;
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatClockUnits(seconds) {
  const value = seconds / HUMMOD_SOURCE_CLOCK.secondsPerUnit;
  return Number(value.toPrecision(15)).toString();
}

function createHumModScriptedExportRequest({
  trajectoryId,
  durationSec,
  sampleIntervalSec,
  symbols,
  dataFilename = 'VentHumModTrajectory.DAT',
  logFilename = 'VentHumModTrajectory.LOG',
  scenarioId = null,
  notes = null,
} = {}) {
  safeFilename(dataFilename, 'dataFilename');
  safeFilename(logFilename, 'logFilename');
  if (dataFilename === logFilename) {
    throw new Error('dataFilename and logFilename must differ');
  }

  const runRequest = createHumModRunRequest({
    trajectoryId,
    durationSec,
    sampleIntervalSec,
    symbols,
    scenarioId,
    notes,
  });

  const requestedSymbols = runRequest.requestedOutput.symbols;
  const roster = [HUMMOD_SOURCE_CLOCK.symbol, ...requestedSymbols];
  const durationUnits = formatClockUnits(durationSec);
  const sampleUnits = formatClockUnits(sampleIntervalSec);

  const variableXml = roster
    .map(name => [
      '      <variable>',
      '        <name>' + xmlEscape(name) + '</name>',
      '      </variable>',
    ].join('\n'))
    .join('\n');

  const xml = [
    '<?xml version="1.0"?>',
    '<remoterequest>',
    '  <scripted>',
    '    <fileopencreate>' + xmlEscape(dataFilename) + '</fileopencreate>',
    '    <fileroster>',
    variableXml,
    '    </fileroster>',
    '    <filewriteheader/>',
    '    <fileupdate/>',
    '    <filestarttracking/>',
    '    <advancefor>',
    '      <solutionint>' + durationUnits + '</solutionint>',
    '      <displayint>' + sampleUnits + '</displayint>',
    '      <storageint>' + sampleUnits + '</storageint>',
    '    </advancefor>',
    '    <filestoptracking/>',
    '    <fileclose/>',
    '  </scripted>',
    '  <remote>',
    '    <logfile>' + xmlEscape(logFilename) + '</logfile>',
    '  </remote>',
    '</remoterequest>',
    '',
  ].join('\n');

  return Object.freeze({
    schema: HUMMOD_SCRIPT_REQUEST_SCHEMA,
    trajectoryId: runRequest.trajectoryId,
    source: Object.freeze({
      repository: HUMMOD_STANDALONE_UPSTREAM.repository,
      revision: HUMMOD_STANDALONE_UPSTREAM.revision,
    }),
    clock: HUMMOD_SOURCE_CLOCK,
    requestedSymbols: Object.freeze(requestedSymbols.slice()),
    roster: Object.freeze(roster),
    durationSec,
    sampleIntervalSec,
    durationHumModMinutes: Number(durationUnits),
    sampleIntervalHumModMinutes: Number(sampleUnits),
    dataFilename,
    logFilename,
    scenarioId: runRequest.scenarioId,
    notes: runRequest.notes,
    requestXml: xml,
    expectedRawSchema: 'hummod-raw-series/v1',
    status: 'script-generated-not-executed',
    provenance: Object.freeze({
      controlSchema:
        'HumMod documentation scripted/remote control: advancefor, fileroster, ' +
        'fileupdate, filestarttracking, filestoptracking, logfile',
      outputParsing:
        'HumMod native data-file parser still required before canonical ingestion',
    }),
  });
}

function defaultHumModScriptedExportRequest(options = {}) {
  return createHumModScriptedExportRequest({
    ...options,
    symbols: options.symbols ||
      listVerifiedDirectMappings().map(mapping => mapping.symbol),
  });
}

module.exports = {
  HUMMOD_SCRIPT_REQUEST_SCHEMA,
  createHumModScriptedExportRequest,
  defaultHumModScriptedExportRequest,
};
