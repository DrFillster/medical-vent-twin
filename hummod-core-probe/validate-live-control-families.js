#!/usr/bin/env node
'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const hummodRoot = process.argv[2];
const rootDir = process.argv[3] ||
  path.resolve(process.cwd(), 'runtime', 'live-family-validation');

if (!hummodRoot) {
  throw new Error(
    'usage: node scripts/validate-live-control-families.js <HumModRoot> [output-dir]'
  );
}
fs.mkdirSync(rootDir, { recursive: true });

const hostScript = path.resolve(__dirname, 'family-session-host.ps1');

async function runFamily({ name, assignments, symbols, timeoutMs = 90000 }) {
  const sessionDir = path.join(rootDir, name);
  fs.mkdirSync(sessionDir, { recursive: true });

  const proc = spawn(
    'pwsh',
    [
      '-NoProfile',
      '-File', hostScript,
      '-HumModRoot', path.resolve(hummodRoot),
      '-SessionDirectory', sessionDir,
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
      let msg;
      try { msg = JSON.parse(line); } catch { continue; }
      const waiter = waiters.shift();
      if (waiter) waiter.resolve(msg);
    }
  });

  function nextMessage(ms = timeoutMs) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(name + ': timed out waiting for host response'));
      }, ms);
      waiters.push({
        resolve(value) {
          clearTimeout(timer);
          resolve(value);
        },
      });
    });
  }

  async function command(payload, ms = timeoutMs) {
    const pending = nextMessage(ms);
    proc.stdin.write(JSON.stringify(payload) + '\n');
    const response = await pending;
    if (!response.ok) throw new Error(response.error || 'native command failed');
    return response;
  }

  const report = {
    name,
    assignments,
    symbols,
    success: false,
  };

  try {
    const ready = await nextMessage(30000);
    report.ready = ready;

    await command({ command: 'initialize' });
    const baseline = await command({ command: 'read', symbols });
    report.baseline = baseline;

    const liveSet = await command({
      command: 'live-set',
      assignments,
    });
    report.liveSet = liveSet;

    const immediate = await command({ command: 'read', symbols });
    report.immediate = immediate;

    await command({ command: 'advance', durationSec: 1 });
    const afterAdvance = await command({ command: 'read', symbols });
    report.afterAdvance = afterAdvance;

    const expected = assignments;
    report.persisted = Object.fromEntries(
      Object.entries(expected).map(([symbol, value]) => [
        symbol,
        afterAdvance.state[symbol] === value,
      ])
    );
    report.success = Object.values(report.persisted).every(Boolean);

    await command({ command: 'terminate' }, 30000);
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
    try { proc.kill(); } catch {}
  }

  fs.writeFileSync(
    path.join(rootDir, name + '-report.json'),
    JSON.stringify(report, null, 2) + '\n'
  );
  return report;
}

async function main() {
  const ventilator = await runFamily({
    name: 'ventilator',
    assignments: {
      'Ventilator.Switch': 1,
      'Ventilator.Rate': 12,
      'Ventilator.TidalVolume': 500,
    },
    symbols: [
      'Ventilator.Switch',
      'Ventilator.Rate',
      'Ventilator.TidalVolume',
      'Breathing.RespRate',
      'Breathing.TidalVolume',
    ],
  });

  const inspiredGas = await runFamily({
    name: 'inspired-gas',
    assignments: {
      'AirSupply-GasTanks.Switch': 1,
      'AirSupply-GasTanks.O2Valve(%)': 40,
      'AirSupply-GasTanks.N2Valve(%)': 60,
      'AirSupply-GasTanks.CO2Valve(%)': 0,
    },
    symbols: [
      'AirSupply-GasTanks.Switch',
      'AirSupply-GasTanks.O2Valve(%)',
      'AirSupply-GasTanks.N2Valve(%)',
      'AirSupply-GasTanks.CO2Valve(%)',
      'AirSupply-InspiredAir.O2Fraction',
      'AirSupply-InspiredAir.N2Fraction',
    ],
  });

  const summary = {
    schema: 'hummod-vent-core/live-control-family-validation/v1',
    ventilator,
    inspiredGas,
  };

  fs.writeFileSync(
    path.join(rootDir, 'summary.json'),
    JSON.stringify(summary, null, 2) + '\n'
  );
  console.log(JSON.stringify(summary, null, 2));

  if (!ventilator.success || !inspiredGas.success) {
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
