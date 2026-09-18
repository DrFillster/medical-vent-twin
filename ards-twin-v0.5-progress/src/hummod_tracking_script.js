'use strict';

// hummod_tracking_script.js
//
// Generates a HumMod <scripted> fragment using only documented HumMod control
// elements. It is intended for an external runner working against the pinned
// standalone source. Vent does not patch, vendor, or execute HumMod itself.
//
// HumMod documentation used by this contract:
// - scripted control supports fileroster, fileopencreate, filewriteheader,
//   filestarttracking, advancefor, filestoptracking, and fileclose
// - the pinned model clock System.X is in minutes
//
// The generated file format is intentionally NOT parsed here. We need one real
// runtime output before defining a parser for delimiters/layout semantics.

const {
  HUMMOD_RUN_REQUEST_SCHEMA,
  HUMMOD_SOURCE_CLOCK,
} = require('./hummod_runner_contract.js');

const TRACKING_SCRIPT_SCHEMA = 'vent-hummod-tracking-script/v1';

function safeFilename(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9._-]+$/.test(value)) {
    throw new Error('outputFilename must contain only letters, numbers, dot, underscore, or hyphen');
  }
  return value;
}

function numberText(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error('time interval must be a finite positive number');
  }
  // Avoid locale formatting and scientific notation for ordinary runner
  // intervals. Twelve decimal places is ample for the second->minute mapping.
  return Number(value.toFixed(12)).toString();
}

function secondsToHumModMinutes(seconds) {
  return seconds / HUMMOD_SOURCE_CLOCK.secondsPerUnit;
}

function variableXml(symbol) {
  return [
    '    <variable>',
    '      <name>' + symbol + '</name>',
    '    </variable>',
  ].join('\n');
}

function createHumModTrackingScript(runRequest, {
  outputFilename = 'vent-hummod-output.dat',
  includeHeader = true,
} = {}) {
  if (!runRequest || runRequest.schema !== HUMMOD_RUN_REQUEST_SCHEMA) {
    throw new Error('validated HumMod run request is required');
  }
  if (runRequest.executable !== true) {
    throw new Error('HumMod run request is not executable');
  }
  if (runRequest.sourceClock.unit !== 'minute' ||
      runRequest.sourceClock.secondsPerUnit !== 60) {
    throw new Error('HumMod source-clock contract does not match pinned runner');
  }

  safeFilename(outputFilename);

  const durationMin = secondsToHumModMinutes(runRequest.requestedOutput.durationSec);
  const sampleMin = secondsToHumModMinutes(runRequest.requestedOutput.sampleIntervalSec);
  const symbols = ['System.X', ...runRequest.requestedOutput.symbols];

  const lines = [
    '<scripted>',
    '  <fileopencreate>' + outputFilename + '</fileopencreate>',
    '  <fileroster>',
    ...symbols.flatMap(symbol => variableXml(symbol).split('\n')),
    '  </fileroster>',
  ];

  if (includeHeader) lines.push('  <filewriteheader/>');

  lines.push(
    '  <filestarttracking/>',
    '  <advancefor>',
    '    <solutionint>' + numberText(durationMin) + '</solutionint>',
    '    <displayint>' + numberText(sampleMin) + '</displayint>',
    '    <storageint>' + numberText(sampleMin) + '</storageint>',
    '  </advancefor>',
    '  <filestoptracking/>',
    '  <fileclose/>',
    '</scripted>'
  );

  return Object.freeze({
    schema: TRACKING_SCRIPT_SCHEMA,
    trajectoryId: runRequest.trajectoryId,
    outputFilename,
    source: runRequest.source,
    sourceClock: runRequest.sourceClock,
    variables: Object.freeze(symbols),
    humModIntervals: Object.freeze({
      solutionMinutes: durationMin,
      displayMinutes: sampleMin,
      storageMinutes: sampleMin,
    }),
    script: lines.join('\n') + '\n',
    parserStatus: 'awaiting-real-runtime-output-sample',
  });
}

module.exports = {
  TRACKING_SCRIPT_SCHEMA,
  secondsToHumModMinutes,
  createHumModTrackingScript,
};
