'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHumModRunRequest } = require('../src/hummod_runner_contract.js');
const { generateHumModRemoteRequest } = require('../src/hummod_remote_request.js');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'hummod-runner');
fs.mkdirSync(outDir, { recursive: true });

const runRequest = createHumModRunRequest({
  trajectoryId: 'moderate-aspiration-reference-001',
  durationSec: 300,
  sampleIntervalSec: 5,
  scenarioId: 'berlin-moderate-moderate-aspiration',
  notes: 'First real HumMod integration reference run; not a clinical patient.',
});

const remote = generateHumModRemoteRequest({
  runRequest,
  outputFile: 'VentHumMod-output.txt',
  logFile: 'VentHumMod-done.log',
});

fs.writeFileSync(
  path.join(outDir, 'reference-run-request.json'),
  JSON.stringify(runRequest, null, 2) + '\n');
fs.writeFileSync(
  path.join(outDir, 'BasicListener.candidate.DAT'),
  remote.xml);
fs.writeFileSync(
  path.join(outDir, 'remote-request-manifest.json'),
  JSON.stringify({
    schema: remote.schema,
    runtimeVerified: remote.runtimeVerified,
    runtimeVerificationStatus: remote.runtimeVerificationStatus,
    outputFile: remote.outputFile,
    logFile: remote.logFile,
    roster: remote.roster,
    documentationBasis: remote.documentationBasis,
  }, null, 2) + '\n');

console.log('Built candidate HumMod reference remote request in hummod-runner/.');
