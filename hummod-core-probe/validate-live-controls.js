#!/usr/bin/env node
'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const hummodRoot = process.argv[2];
const sessionDir = process.argv[3] ||
  path.resolve(process.cwd(), 'runtime', 'live-control-validation');

if (!hummodRoot) {
  throw new Error(
    'usage: node scripts/validate-live-controls.js <HumModRoot> [session-dir]'
  );
}
fs.mkdirSync(sessionDir, { recursive: true });

const proc = spawn(
  'pwsh',
  [
    '-NoProfile',
    '-File', path.resolve(__dirname, 'live-control-session-host.ps1'),
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
    let message;
    try { message = JSON.parse(line); } catch { continue; }
    const waiter = waiters.shift();
    if (waiter) waiter.resolve(message);
  }
});

function nextMessage(timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('timed out waiting for native HumMod host response')),
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

async function command(payload, timeoutMs = 90000) {
  const pending = nextMessage(timeoutMs);
  proc.stdin.write(JSON.stringify(payload) + '\n');
  const response = await pending;
  if (!response.ok) {
    throw new Error(response.error || 'native HumMod host command failed');
  }
  return response;
}

const inputSymbols = [
  'Ventilator.Switch',
  'Ventilator.Rate',
  'Ventilator.TidalVolume',
  'AirSupply-GasTanks.Switch',
  'AirSupply-GasTanks.O2Valve(%)',
  'AirSupply-GasTanks.N2Valve(%)',
  'AirSupply-GasTanks.CO2Valve(%)',
  'LeftHemithorax.NormalPressure',
  'RightHemithorax.NormalPressure',
];

const physiologySymbols = [
  'Thorax.AvePressure',
  'RightAtrium.Pressure',
  'PulmArty.Pressure',
  'CardiacOutput.Flow(L/Min)',
  'SystemicArtys.Pressure',
  'Heart-Rate.Rate',
  'PO2Artys.Pressure',
  'CO2Artys.Pressure',
  'BloodPh.ArtysPh',
];

const expected = {
  'Ventilator.Switch': 1,
  'Ventilator.Rate': 12,
  'Ventilator.TidalVolume': 500,
  'AirSupply-GasTanks.Switch': 1,
  'AirSupply-GasTanks.O2Valve(%)': 40,
  'AirSupply-GasTanks.N2Valve(%)': 60,
  'AirSupply-GasTanks.CO2Valve(%)': 0,
  'LeftHemithorax.NormalPressure': 0,
  'RightHemithorax.NormalPressure': 0,
};

function exactStateMatches(state) {
  const perSymbol = {};
  for (const [symbol, value] of Object.entries(expected)) {
    perSymbol[symbol] = state[symbol] === value;
  }
  return {
    perSymbol,
    all: Object.values(perSymbol).every(Boolean),
  };
}

async function main() {
  const ready = await nextMessage(30000);
  if (!ready.ok || ready.event !== 'ready') {
    throw new Error('native HumMod host did not become ready');
  }

  await command({ command: 'initialize' });
  await command({ command: 'checkpoint', checkpointId: 'baseline' });

  const baselineInputs = await command({
    command: 'read',
    symbols: inputSymbols,
  });
  const baselinePhysiology = await command({
    command: 'read',
    symbols: physiologySymbols,
  });

  const liveSet = await command({
    command: 'live-set',
    assignments: expected,
  });

  const immediateInputs = await command({
    command: 'read',
    symbols: inputSymbols,
  });
  const immediatePhysiology = await command({
    command: 'read',
    symbols: physiologySymbols,
  });

  await command({ command: 'advance', durationSec: 1 });

  const afterAdvanceInputs = await command({
    command: 'read',
    symbols: inputSymbols,
  });
  const afterAdvancePhysiology = await command({
    command: 'read',
    symbols: physiologySymbols,
  });

  const immediateMatch = exactStateMatches(immediateInputs.state);
  const persistedMatch = exactStateMatches(afterAdvanceInputs.state);

  await command({ command: 'restore', checkpointId: 'baseline' });

  const restoredInputs = await command({
    command: 'read',
    symbols: inputSymbols,
  });
  const restoredPhysiology = await command({
    command: 'read',
    symbols: physiologySymbols,
  });

  await command({ command: 'terminate' }, 30000);

  const restoreInputsExact = inputSymbols.every(
    symbol => restoredInputs.state[symbol] === baselineInputs.state[symbol]
  );
  const restorePhysiologyExact = physiologySymbols.every(
    symbol => restoredPhysiology.state[symbol] === baselinePhysiology.state[symbol]
  );

  const report = {
    schema: 'hummod-vent-core/live-control-validation/v1',
    ready: {
      processId: ready.processId,
      executableSha256: ready.executableSha256,
      upstreamRevision: ready.upstreamRevision,
    },
    expected,
    baselineInputs,
    baselinePhysiology,
    liveSet,
    immediateInputs,
    immediatePhysiology,
    afterAdvanceInputs,
    afterAdvancePhysiology,
    restoredInputs,
    restoredPhysiology,
    checks: {
      sameProcessSession: true,
      immediateNativeReadbackMatches: immediateMatch.all,
      immediatePerSymbol: immediateMatch.perSymbol,
      survivesSolverAdvance: persistedMatch.all,
      persistedPerSymbol: persistedMatch.perSymbol,
      thoraxPressureBecameZero:
        afterAdvancePhysiology.state['Thorax.AvePressure'] === 0,
      checkpointRestoredInputsExactly: restoreInputsExact,
      checkpointRestoredPhysiologyExactly: restorePhysiologyExact,
    },
  };

  fs.writeFileSync(
    path.join(sessionDir, 'live-control-validation.json'),
    JSON.stringify(report, null, 2) + '\n'
  );
  console.log(JSON.stringify(report, null, 2));

  if (!report.checks.immediateNativeReadbackMatches ||
      !report.checks.survivesSolverAdvance ||
      !report.checks.thoraxPressureBecameZero ||
      !report.checks.checkpointRestoredInputsExactly ||
      !report.checks.checkpointRestoredPhysiologyExactly) {
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error(error);
  try { proc.kill(); } catch {}
  process.exitCode = 1;
});
