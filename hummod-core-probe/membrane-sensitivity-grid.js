#!/usr/bin/env node
'use strict';

const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const hummodRoot = process.argv[2];
const sessionDir = process.argv[3] ||
  path.resolve(process.cwd(), 'runtime', 'membrane-sensitivity-grid');

if (!hummodRoot) {
  throw new Error(
    'usage: node scripts/membrane-sensitivity-grid.js <HumModRoot> [session-dir]'
  );
}

fs.mkdirSync(sessionDir, { recursive: true });

const hostScript = path.resolve(__dirname, 'gas-grid-session-host.ps1');
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

proc.stdout.setEncoding('utf8');
proc.stdout.on('data', chunk => {
  buffer += chunk;
  while (buffer.includes('\n')) {
    const i = buffer.indexOf('\n');
    const line = buffer.slice(0, i).trim();
    buffer = buffer.slice(i + 1);
    if (!line) continue;
    let parsed;
    try { parsed = JSON.parse(line); } catch { continue; }
    const waiter = waiters.shift();
    if (waiter) waiter.resolve(parsed);
  }
});

function nextMessage(timeoutMs = 90000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('timed out waiting for native HumMod host')),
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

async function command(payload, timeoutMs = 120000) {
  const pending = nextMessage(timeoutMs);
  proc.stdin.write(JSON.stringify(payload) + '\n');
  const response = await pending;
  if (!response.ok) throw new Error(response.error || 'native command failed');
  return response;
}

const AREAS = Object.freeze([80, 60, 40]);
const THICKNESS = Object.freeze([0.6, 1.2, 2.0]);
const ADVANCE_SEC = 10;

const symbols = [
  'PulmonaryMembrane.TotalArea',
  'PulmonaryMembrane.Thickness-Structure',
  'PulmonaryMembrane.Recruitment',
  'PulmonaryMembrane.ActiveArea',
  'PulmonaryMembrane.Thickness',
  'PulmonaryMembrane.DiffusingCapacity',
  'PO2Artys.Pressure',
  'CO2Artys.Pressure',
  'BloodPh.ArtysPh',
  'CardiacOutput.Flow(L/Min)',
  'SystemicArtys.Pressure',
];

async function main() {
  const ready = await nextMessage(45000);
  if (!ready.ok || ready.event !== 'ready') {
    throw new Error('native host did not become ready');
  }

  await command({ command: 'initialize' });
  await command({ command: 'checkpoint', checkpointId: 'grid-baseline' });

  const baseline = await command({ command: 'read', symbols });
  const rows = [];

  for (const totalAreaM2 of AREAS) {
    for (const structuralThicknessMicron of THICKNESS) {
      await command({
        command: 'restore',
        checkpointId: 'grid-baseline',
      });

      const liveSet = await command({
        command: 'live-set',
        assignments: {
          'PulmonaryMembrane.TotalArea': totalAreaM2,
          'PulmonaryMembrane.Thickness-Structure':
            structuralThicknessMicron,
        },
      });

      await command({
        command: 'advance',
        durationSec: ADVANCE_SEC,
      });

      const after = await command({ command: 'read', symbols });

      rows.push({
        totalAreaM2,
        structuralThicknessMicron,
        liveSetReadback: liveSet.state,
        simulationTimeSec: after.simulationTimeSec,
        state: after.state,
        deltasFromBaseline: {
          diffusingCapacity:
            after.state['PulmonaryMembrane.DiffusingCapacity'] -
            baseline.state['PulmonaryMembrane.DiffusingCapacity'],
          pao2MmHg:
            after.state['PO2Artys.Pressure'] -
            baseline.state['PO2Artys.Pressure'],
          paco2MmHg:
            after.state['CO2Artys.Pressure'] -
            baseline.state['CO2Artys.Pressure'],
          ph:
            after.state['BloodPh.ArtysPh'] -
            baseline.state['BloodPh.ArtysPh'],
        },
      });
    }
  }

  await command({
    command: 'restore',
    checkpointId: 'grid-baseline',
  });
  const restored = await command({ command: 'read', symbols });
  await command({ command: 'terminate' }, 30000);

  const exactRestore = symbols.every(
    symbol => restored.state[symbol] === baseline.state[symbol]
  );

  const allSettingsPersist = rows.every(row =>
    row.state['PulmonaryMembrane.TotalArea'] === row.totalAreaM2 &&
    Math.abs(
      row.state['PulmonaryMembrane.Thickness-Structure'] -
      row.structuralThicknessMicron
    ) < 1e-9
  );

  const report = {
    schema: 'hummod-vent-core/membrane-sensitivity-grid/v1',
    purpose:
      'engineering sensitivity characterization; not ARDS calibration or clinical validation',
    provenance: {
      upstreamRevision: ready.upstreamRevision,
      executableSha256: ready.executableSha256,
      processId: ready.processId,
    },
    grid: {
      totalAreaM2: AREAS,
      structuralThicknessMicron: THICKNESS,
      advanceSec: ADVANCE_SEC,
    },
    baseline,
    rows,
    restored,
    checks: {
      sameProcessSession: true,
      allSettingsPersist,
      checkpointRestoreExact: exactRestore,
      rowCount: rows.length,
    },
  };

  fs.writeFileSync(
    path.join(sessionDir, 'membrane-sensitivity-grid.json'),
    JSON.stringify(report, null, 2) + '\n'
  );
  console.log(JSON.stringify(report, null, 2));

  if (!allSettingsPersist || !exactRestore || rows.length !== 9) {
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error(error);
  try { proc.kill(); } catch {}
  process.exitCode = 1;
});
