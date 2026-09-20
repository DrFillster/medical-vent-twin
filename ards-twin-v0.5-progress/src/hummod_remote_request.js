'use strict';

// hummod_remote_request.js
//
// Generates a documentation-grounded HumMod remote request that asks the
// equation solver to track exact verified variables to a file while advancing
// non-interactively.
//
// IMPORTANT: this generator is schema-derived from HumMod documentation and
// is rejected by the pinned HumMod.EXE at the remote bootstrap element.
// The 2026-09-20 Windows probe captured parser error 2220. Generation remains
// useful for a future compatible runtime; it does not establish executability.

const {
  HUMMOD_RUN_REQUEST_SCHEMA,
  HUMMOD_SOURCE_CLOCK,
} = require('./hummod_runner_contract.js');

const HUMMOD_REMOTE_REQUEST_SCHEMA = 'vent-hummod-remote-request/v1';

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function finitePositive(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(label + ' must be a finite positive number');
  }
  return value;
}

function nonEmptyString(value, label) {
  if (typeof value !== 'string' || !value) {
    throw new Error(label + ' must be a non-empty string');
  }
  return value;
}

function generateHumModRemoteRequest({
  runRequest,
  outputFile,
  logFile,
  includeFinalUpdate = true,
} = {}) {
  if (!runRequest || runRequest.schema !== HUMMOD_RUN_REQUEST_SCHEMA) {
    throw new Error('valid vent-hummod-run-request/v1 is required');
  }
  if (runRequest.executable !== true) {
    throw new Error('HumMod run request must be executable');
  }
  nonEmptyString(outputFile, 'outputFile');
  nonEmptyString(logFile, 'logFile');

  const durationSec = finitePositive(
    runRequest.requestedOutput.durationSec,
    'runRequest.requestedOutput.durationSec');
  const sampleIntervalSec = finitePositive(
    runRequest.requestedOutput.sampleIntervalSec,
    'runRequest.requestedOutput.sampleIntervalSec');

  const durationMinutes = durationSec / HUMMOD_SOURCE_CLOCK.secondsPerUnit;
  const sampleMinutes = sampleIntervalSec / HUMMOD_SOURCE_CLOCK.secondsPerUnit;
  if (sampleMinutes > durationMinutes) {
    throw new Error('sample interval exceeds requested duration');
  }

  const roster = [
    HUMMOD_SOURCE_CLOCK.symbol,
    ...runRequest.requestedOutput.symbols,
  ];

  const lines = [];
  lines.push('<remoterequest>');
  lines.push('  <scripted>');
  lines.push('    <setpagerstatus>OFF</setpagerstatus>');
  lines.push('    <fileopencreate>' + xmlEscape(outputFile) + '</fileopencreate>');
  lines.push('    <fileroster>');
  roster.forEach(name => {
    lines.push('      <variable><name>' + xmlEscape(name) + '</name></variable>');
  });
  lines.push('    </fileroster>');
  lines.push('    <filewriteheader/>');
  lines.push('    <filestarttracking/>');
  lines.push('    <advancefor>');
  lines.push('      <solutionint>' + durationMinutes + '</solutionint>');
  lines.push('      <displayint>' + sampleMinutes + '</displayint>');
  lines.push('      <storageint>' + sampleMinutes + '</storageint>');
  lines.push('    </advancefor>');
  lines.push('    <filestoptracking/>');
  if (includeFinalUpdate) lines.push('    <fileupdate/>');
  lines.push('    <fileclose/>');
  lines.push('  </scripted>');
  lines.push('  <remote>');
  lines.push('    <logfile>' + xmlEscape(logFile) + '</logfile>');
  lines.push('  </remote>');
  lines.push('</remoterequest>');
  lines.push('');

  return Object.freeze({
    schema: HUMMOD_REMOTE_REQUEST_SCHEMA,
    runtimeVerified: false,
    runtimeVerificationStatus:
      'pinned-runtime-rejects-remote-control',
    runRequest,
    outputFile,
    logFile,
    sourceClock: HUMMOD_SOURCE_CLOCK,
    roster: Object.freeze(roster),
    xml: lines.join('\n'),
    documentationBasis: Object.freeze([
      'HumMod/documentation@1cd093c001ea5af72e666a20e51542dce2304b38:schema/3_control/remote.html',
      'HumMod/documentation@1cd093c001ea5af72e666a20e51542dce2304b38:schema/3_control/scripted.html',
    ]),
  });
}

module.exports = {
  HUMMOD_REMOTE_REQUEST_SCHEMA,
  generateHumModRemoteRequest,
  xmlEscape,
};
