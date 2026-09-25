#!/usr/bin/env node
'use strict';

const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const hummodRoot = process.argv[2];
const sessionDir = process.argv[3] ||
  path.resolve(process.cwd(), 'runtime', 'decoupled-thorax-validation');

if (!hummodRoot) {
  throw new Error(
    'usage: node decoupled-thorax-validation.js <HumModRoot> [session-dir]'
  );
}
fs.mkdirSync(sessionDir, { recursive: true });

const hostScript =
  path.resolve(__dirname, 'decoupled-thorax-session-host.ps1');
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

function nextMessage(timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('timed out waiting for native host')),
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

async function command(payload, timeoutMs = 180000) {
  const pending = nextMessage(timeoutMs);
  proc.stdin.write(JSON.stringify(payload) + '\n');
  const response = await pending;
  if (!response.ok) {
    throw new Error(response.error || 'native command failed');
  }
  return response;
}

function near(a, b, tolerance = 1e-9) {
  return Math.abs(Number(a) - Number(b)) <= tolerance;
}

const symbols = [
  'Thorax.CoupledPressureSwitch',
  'Thorax.CoupledPressure',
  'Thorax.AvePressure',
  'RightHemithorax.Pressure',
  'LeftHemithorax.Pressure',
  'RightHemithorax.LungInflation',
  'LeftHemithorax.LungInflation',
  'LungBloodFlow.AlveolarShunt',
  'LungBloodFlow.TotalShunt',
  'RightAtrium.Pressure',
  'PulmArty.Pressure',
  'CardiacOutput.Flow(L/Min)',
  'SystemicArtys.Pressure',
  'Heart-Rate.Rate',
  'PO2Artys.Pressure',
  'CO2Artys.Pressure',
  'BloodPh.ArtysPh',
];

const stockBaseline = Object.freeze({
  'SystemicArtys.Pressure': 96.1290322580645,
  'Heart-Rate.Rate': 72.1519231143317,
  'CardiacOutput.Flow(L/Min)': 5.50405387990819,
  'PO2Artys.Pressure': 94.009870530838,
  'CO2Artys.Pressure': 40.3937738764693,
  'BloodPh.ArtysPh': 7.42310423895973,
});

async function main() {
  const ready = await nextMessage(45000);
  if (!ready.ok || ready.event !== 'ready') {
    throw new Error('native host did not become ready');
  }

  await command({ command: 'initialize' });
  await command({
    command: 'checkpoint',
    checkpointId: 'decoupled-thorax-baseline',
  });

  const baseline = await command({ command: 'read', symbols });

  for (const [symbol, expected] of Object.entries(stockBaseline)) {
    if (!near(baseline.state[symbol], expected)) {
      throw new Error(
        'patched baseline differs from stock for ' + symbol +
        ': expected ' + expected + ', got ' + baseline.state[symbol]
      );
    }
  }

  if (!near(baseline.state['Thorax.CoupledPressureSwitch'], 0) ||
      !near(baseline.state['Thorax.CoupledPressure'], -4) ||
      !near(baseline.state['Thorax.AvePressure'], -4) ||
      !near(baseline.state['RightHemithorax.Pressure'], -4) ||
      !near(baseline.state['LeftHemithorax.Pressure'], -4) ||
      !near(baseline.state['RightHemithorax.LungInflation'], 1) ||
      !near(baseline.state['LeftHemithorax.LungInflation'], 1)) {
    throw new Error('patched thorax baseline is not native-equivalent');
  }

  const liveSet = await command({
    command: 'live-set',
    assignments: {
      'Thorax.CoupledPressureSwitch': 1,
      'Thorax.CoupledPressure': 0,
    },
  });

  const immediate = await command({ command: 'read', symbols });

  const decoupled =
    near(immediate.state['Thorax.CoupledPressureSwitch'], 1) &&
    near(immediate.state['Thorax.CoupledPressure'], 0) &&
    near(immediate.state['Thorax.AvePressure'], 0) &&
    near(immediate.state['RightHemithorax.Pressure'], -4) &&
    near(immediate.state['LeftHemithorax.Pressure'], -4) &&
    near(immediate.state['RightHemithorax.LungInflation'], 1) &&
    near(immediate.state['LeftHemithorax.LungInflation'], 1);

  const alveolarShuntUnaffectedImmediately = near(
    immediate.state['LungBloodFlow.AlveolarShunt'],
    baseline.state['LungBloodFlow.AlveolarShunt']
  );

  const systemicPressurePathResponded =
    !near(
      immediate.state['RightAtrium.Pressure'],
      baseline.state['RightAtrium.Pressure']
    ) &&
    !near(
      immediate.state['PulmArty.Pressure'],
      baseline.state['PulmArty.Pressure']
    );

  await command({ command: 'advance', durationSec: 1 });
  const afterOneSec = await command({ command: 'read', symbols });

  const exactOneSecondAdvance = near(
    afterOneSec.simulationTimeSec,
    0.999996,
    1e-5
  );

  const survivesAdvance =
    near(afterOneSec.state['Thorax.CoupledPressureSwitch'], 1) &&
    near(afterOneSec.state['Thorax.CoupledPressure'], 0) &&
    near(afterOneSec.state['Thorax.AvePressure'], 0) &&
    near(afterOneSec.state['RightHemithorax.Pressure'], -4) &&
    near(afterOneSec.state['LeftHemithorax.Pressure'], -4) &&
    near(afterOneSec.state['RightHemithorax.LungInflation'], 1) &&
    near(afterOneSec.state['LeftHemithorax.LungInflation'], 1);

  await command({
    command: 'restore',
    checkpointId: 'decoupled-thorax-baseline',
  });
  const restored = await command({ command: 'read', symbols });
  await command({ command: 'terminate' }, 30000);

  const exactRestore = symbols.every(
    symbol => restored.state[symbol] === baseline.state[symbol]
  );

  const report = {
    schema: 'hummod-vent-core/decoupled-thorax-validation/v1',
    provenance: {
      upstreamRevision: ready.upstreamRevision,
      executableSha256: ready.executableSha256,
      processId: ready.processId,
    },
    intervention: {
      coupledPressureSwitch: 1,
      coupledPressureMmHg: 0,
      advanceSec: 1,
    },
    baseline,
    liveSet,
    immediate,
    afterOneSec,
    restored,
    checks: {
      patchedBaselineMatchesStockCore: true,
      bridgeDecouplesSystemicPressureFromLungInflation: decoupled,
      alveolarShuntUnaffectedImmediately,
      systemicPressurePathResponded,
      exactOneSecondAdvance,
      bridgeSurvivesSolverAdvance: survivesAdvance,
      checkpointRestoreExact: exactRestore,
    },
  };

  fs.writeFileSync(
    path.join(sessionDir, 'decoupled-thorax-validation.json'),
    JSON.stringify(report, null, 2) + '\n'
  );
  console.log(JSON.stringify(report, null, 2));

  if (!decoupled ||
      !alveolarShuntUnaffectedImmediately ||
      !systemicPressurePathResponded ||
      !exactOneSecondAdvance ||
      !survivesAdvance ||
      !exactRestore) {
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error(error);
  try { proc.kill(); } catch {}
  process.exitCode = 1;
});
