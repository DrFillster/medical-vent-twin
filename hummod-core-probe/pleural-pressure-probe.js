#!/usr/bin/env node
'use strict';

const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const hummodRoot = process.argv[2];
const sessionDir = process.argv[3] ||
  path.resolve(process.cwd(), 'runtime', 'pleural-pressure-probe');

if (!hummodRoot) {
  throw new Error(
    'usage: node scripts/pleural-pressure-probe.js <HumModRoot> [session-dir]'
  );
}

fs.mkdirSync(sessionDir, { recursive: true });

const hostScript = path.resolve(__dirname, 'pressure-session-host.ps1');
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
  try { parsed = JSON.parse(line); } catch { return; }
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

async function command(payload, timeoutMs = 60000) {
  const pending = nextMessage(timeoutMs);
  proc.stdin.write(JSON.stringify(payload) + '\n');
  const response = await pending;
  if (!response.ok) throw new Error(response.error || 'native host command failed');
  return response;
}

const symbols = [
  'Thorax.AvePressure',
  'RightAtrium.Pressure',
  'PulmArty.Pressure',
  'CardiacOutput.Flow(L/Min)',
  'SystemicArtys.Pressure',
  'Heart-Rate.Rate',
];

async function main() {
  const ready = await nextMessage(30000);
  if (!ready.ok || ready.event !== 'ready') {
    throw new Error('native host did not become ready');
  }

  await command({ command: 'initialize' }, 60000);
  await command({ command: 'checkpoint', checkpointId: 'baseline' }, 60000);

  const baseline = await command({
    command: 'read',
    symbols,
  }, 60000);

  const setPressure = await command({
    command: 'live-set',
    assignments: {
      'LeftHemithorax.NormalPressure': 0,
      'RightHemithorax.NormalPressure': 0,
    },
  }, 60000);

  await command({ command: 'advance', durationSec: 10 }, 60000);

  const challenged = await command({
    command: 'read',
    symbols,
  }, 60000);

  await command({ command: 'restore', checkpointId: 'baseline' }, 60000);

  const restored = await command({
    command: 'read',
    symbols,
  }, 60000);

  await command({ command: 'terminate' }, 30000);

  const delta = {};
  for (const symbol of symbols) {
    delta[symbol] = challenged.state[symbol] - baseline.state[symbol];
  }

  const exactRestore = symbols.every(
    symbol => restored.state[symbol] === baseline.state[symbol]
  );

  const report = {
    schema: 'hummod-vent-core/pleural-pressure-probe/v1',
    ready: {
      processId: ready.processId,
      executableSha256: ready.executableSha256,
      upstreamRevision: ready.upstreamRevision,
    },
    intervention: {
      leftPleuralPressureMmHg: 0,
      rightPleuralPressureMmHg: 0,
      durationSec: 10,
    },
    baseline,
    setPressure,
    challenged,
    delta,
    restored,
    checks: {
      sameProcessSession: true,
      nativePressureAssignmentVerified:
        setPressure.state['LeftHemithorax.NormalPressure'] === 0 &&
        setPressure.state['RightHemithorax.NormalPressure'] === 0,
      thoraxPressureChanged:
        challenged.state['Thorax.AvePressure'] !== baseline.state['Thorax.AvePressure'],
      hemodynamicResponseObserved:
        challenged.state['RightAtrium.Pressure'] !== baseline.state['RightAtrium.Pressure'] ||
        challenged.state['PulmArty.Pressure'] !== baseline.state['PulmArty.Pressure'] ||
        challenged.state['CardiacOutput.Flow(L/Min)'] !== baseline.state['CardiacOutput.Flow(L/Min)'],
      checkpointRestoreExact: exactRestore,
    },
  };

  fs.writeFileSync(
    path.join(sessionDir, 'pleural-pressure-report.json'),
    JSON.stringify(report, null, 2) + '\n'
  );
  console.log(JSON.stringify(report, null, 2));

  if (!report.checks.nativePressureAssignmentVerified ||
      !report.checks.thoraxPressureChanged ||
      !report.checks.hemodynamicResponseObserved ||
      !report.checks.checkpointRestoreExact) {
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error(error);
  try { proc.kill(); } catch {}
  process.exitCode = 1;
});
