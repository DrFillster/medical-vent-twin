#!/usr/bin/env node
'use strict';

const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const hummodRoot = process.argv[2];
const sessionRoot = process.argv[3] ||
  path.resolve(process.cwd(), 'runtime', 'membrane-sensitivity-grid-isolated');

if (!hummodRoot) {
  throw new Error(
    'usage: node membrane-sensitivity-grid-isolated.js <HumModRoot> [session-root]'
  );
}

fs.mkdirSync(sessionRoot, { recursive: true });

const hostScript = path.resolve(__dirname, 'gas-grid-session-host.ps1');
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

function createClient(sessionDir) {
  fs.mkdirSync(sessionDir, { recursive: true });

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

  return { proc, nextMessage, command };
}

async function runCell(totalAreaM2, structuralThicknessMicron, index) {
  const sessionDir = path.join(
    sessionRoot,
    'cell-' + String(index + 1).padStart(2, '0') +
      '-area-' + totalAreaM2 +
      '-thickness-' + String(structuralThicknessMicron).replace('.', '_')
  );

  const client = createClient(sessionDir);
  try {
    const ready = await client.nextMessage(45000);
    if (!ready.ok || ready.event !== 'ready') {
      throw new Error('native host did not become ready');
    }

    await client.command({ command: 'initialize' });
    const baseline = await client.command({ command: 'read', symbols });

    if (Math.abs(baseline.simulationTimeSec) > 1e-6) {
      throw new Error(
        'fresh native process did not start at time zero: ' +
        baseline.simulationTimeSec
      );
    }

    const liveSet = await client.command({
      command: 'live-set',
      assignments: {
        'PulmonaryMembrane.TotalArea': totalAreaM2,
        'PulmonaryMembrane.Thickness-Structure':
          structuralThicknessMicron,
      },
    });

    await client.command({
      command: 'advance',
      durationSec: ADVANCE_SEC,
    });

    const after = await client.command({ command: 'read', symbols });
    await client.command({ command: 'terminate' }, 30000);

    const expectedTime = ADVANCE_SEC;
    if (Math.abs(after.simulationTimeSec - expectedTime) > 0.01) {
      throw new Error(
        'isolated cell ended at unexpected native time: ' +
        after.simulationTimeSec
      );
    }

    if (after.state['PulmonaryMembrane.TotalArea'] !== totalAreaM2 ||
        Math.abs(
          after.state['PulmonaryMembrane.Thickness-Structure'] -
          structuralThicknessMicron
        ) > 1e-9) {
      throw new Error('membrane control did not persist through solver advance');
    }

    return {
      cellIndex: index + 1,
      processId: ready.processId,
      executableSha256: ready.executableSha256,
      upstreamRevision: ready.upstreamRevision,
      baseline,
      totalAreaM2,
      structuralThicknessMicron,
      liveSetReadback: liveSet.state,
      simulationTimeSec: after.simulationTimeSec,
      state: after.state,
      deltasFromOwnBaseline: {
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
    };
  } finally {
    try {
      if (!client.proc.killed) client.proc.kill();
    } catch {}
  }
}

async function main() {
  const rows = [];
  let index = 0;

  for (const totalAreaM2 of AREAS) {
    for (const structuralThicknessMicron of THICKNESS) {
      rows.push(
        await runCell(
          totalAreaM2,
          structuralThicknessMicron,
          index
        )
      );
      index += 1;
    }
  }

  const processIds = rows.map(row => row.processId);
  const uniqueProcesses = new Set(processIds);

  const report = {
    schema:
      'hummod-vent-core/membrane-sensitivity-grid-isolated/v1',
    purpose:
      'engineering sensitivity characterization using one fresh native HumMod process per grid cell; not ARDS calibration or clinical validation',
    grid: {
      totalAreaM2: AREAS,
      structuralThicknessMicron: THICKNESS,
      advanceSec: ADVANCE_SEC,
    },
    rows,
    checks: {
      rowCount: rows.length,
      oneFreshProcessPerCell:
        uniqueProcesses.size === rows.length,
      allCellsStartedAtTimeZero:
        rows.every(row =>
          Math.abs(row.baseline.simulationTimeSec) <= 1e-6),
      allCellsEndedAtTenSeconds:
        rows.every(row =>
          Math.abs(row.simulationTimeSec - ADVANCE_SEC) <= 0.01),
      allSettingsPersist:
        rows.every(row =>
          row.state['PulmonaryMembrane.TotalArea'] ===
            row.totalAreaM2 &&
          Math.abs(
            row.state['PulmonaryMembrane.Thickness-Structure'] -
            row.structuralThicknessMicron
          ) <= 1e-9),
    },
  };

  fs.writeFileSync(
    path.join(sessionRoot, 'membrane-sensitivity-grid-isolated.json'),
    JSON.stringify(report, null, 2) + '\n'
  );
  console.log(JSON.stringify(report, null, 2));

  if (rows.length !== 9 ||
      !report.checks.oneFreshProcessPerCell ||
      !report.checks.allCellsStartedAtTimeZero ||
      !report.checks.allCellsEndedAtTenSeconds ||
      !report.checks.allSettingsPersist) {
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
