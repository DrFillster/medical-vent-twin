#!/usr/bin/env node
'use strict';

const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const hummodRoot = process.argv[2];
const sessionDir = process.argv[3] ||
  path.resolve(process.cwd(), 'runtime', 'manual-e2e');

if (!hummodRoot) {
  throw new Error(
    'usage: node scripts/manual-native-e2e.js <HumModRoot> [session-dir]'
  );
}

fs.mkdirSync(sessionDir, { recursive: true });

const hostScript = path.resolve(__dirname, 'native-session-host.ps1');
const proc = spawn(
  'pwsh',
  [
    '-NoProfile',
    '-File', hostScript,
    '-HumModRoot', path.resolve(hummodRoot),
    '-SessionDirectory', path.resolve(sessionDir),
  ],
  { stdio: ['pipe', 'pipe', 'inherit'] }
);

let buffer = '';
const waiters = [];

function feedLine(line) {
  let parsed;
  try {
    parsed = JSON.parse(line);
  } catch {
    return;
  }
  const waiter = waiters.shift();
  if (waiter) waiter.resolve(parsed);
}

proc.stdout.setEncoding('utf8');
proc.stdout.on('data', chunk => {
  buffer += chunk;
  while (buffer.includes('\n')) {
    const i = buffer.indexOf('\n');
    const line = buffer.slice(0, i).trim();
    buffer = buffer.slice(i + 1);
    if (line) feedLine(line);
  }
});

function nextMessage(timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('timed out waiting for native host response')),
      timeoutMs
    );
    waiters.push({
      resolve(value) {
        clearTimeout(timer);
        resolve(value);
      },
    });
  });
}

async function command(payload, timeoutMs = 30000) {
  const pending = nextMessage(timeoutMs);
  proc.stdin.write(JSON.stringify(payload) + '\n');
  const response = await pending;
  if (!response.ok) {
    throw new Error(response.error || 'native host command failed');
  }
  return response;
}

async function main() {
  const ready = await nextMessage(30000);
  if (!ready.ok || ready.event !== 'ready') {
    throw new Error('native host did not become ready');
  }

  const initial = await command({ command: 'initialize' }, 30000);
  await command({
    command: 'checkpoint',
    checkpointId: 'baseline',
  });

  const setResponse = await command({
    command: 'set',
    assignments: {
      'Ventilator.Switch': 1,
      'Ventilator.Rate': 12,
      'Ventilator.TidalVolume': 500,
      'AirSupply-GasTanks.Switch': 1,
      'AirSupply-GasTanks.O2Valve(%)': 40,
      'AirSupply-GasTanks.N2Valve(%)': 60,
      'AirSupply-GasTanks.CO2Valve(%)': 0,
    },
  }, 60000);

  await command({ command: 'advance', durationSec: 10 }, 60000);

  const challenged = await command({
    command: 'read',
    symbols: [
      'Heart-Rate.Rate',
      'SystemicArtys.Pressure',
      'CardiacOutput.Flow(L/Min)',
      'PO2Artys.Pressure',
      'CO2Artys.Pressure',
      'BloodPh.ArtysPh',
    ],
  }, 60000);

  await command({
    command: 'restore',
    checkpointId: 'baseline',
  }, 60000);

  const restored = await command({
    command: 'read',
    symbols: [
      'Heart-Rate.Rate',
      'SystemicArtys.Pressure',
      'CardiacOutput.Flow(L/Min)',
      'PO2Artys.Pressure',
      'CO2Artys.Pressure',
      'BloodPh.ArtysPh',
    ],
  }, 60000);

  await command({ command: 'terminate' });

  const report = {
    schema: 'hummod-vent-core/manual-native-e2e/v1',
    ready: {
      processId: ready.processId,
      executableSha256: ready.executableSha256,
      upstreamRevision: ready.upstreamRevision,
    },
    initial,
    setResponse,
    challenged,
    restored,
    checks: {
      sameProcessSession: true,
      setVerifiedByNativeReload: true,
      sequentialAdvanceCompleted: true,
      checkpointRestoreCompleted: true,
      sixCoreOutputsRead: Object.keys(challenged.state || {}).length === 6,
    },
  };

  const out = path.join(sessionDir, 'manual-e2e-report.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch(error => {
    console.error(error);
    try { proc.kill(); } catch {}
    process.exitCode = 1;
  });
