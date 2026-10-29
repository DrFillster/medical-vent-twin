'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const web = path.join(root, 'ards-twin-v1.0/web');
const uiRef = '3a33006dc9b39977c1b2d38f78b9f164e289e5ae';
const physiologyRef = '0c52dd1b575f283126bafe4bf935b36da883ea0b';
let failed = 0;
function check(name, fn) {
  try { fn(); console.log('PASS ' + name); }
  catch (error) { failed++; console.error('FAIL ' + name + ': ' + error.message); }
}
function assert(condition, message) { if (!condition) throw new Error(message); }
function git(...args) { return execFileSync('git', args, { cwd: root, maxBuffer: 8 * 1024 * 1024 }); }
for (const file of ['index.html', 'app.js', 'styles.css', 'clinical-worker.js', 'native-engine-client.js', 'native-engine-config.js']) {
  check('frozen v1.6 ' + file, () => assert(
    fs.readFileSync(path.join(web, file)).equals(git('show', uiRef + ':ards-twin-v1.0/web/' + file)),
    'differs from pinned v1.6 source'));
}
check('v2.4 physiology sources unchanged', () => {
  git('diff', '--exit-code', physiologyRef, '--', 'ards-twin-v0.5-progress/src');
});
check('served engine reproducible from v2.4 sources', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'vent-integration-'));
  try {
    const output = path.join(temp, 'engine.js');
    execFileSync(process.execPath, [path.join(__dirname, 'build.js'), '--engine-output', output]);
    assert(fs.readFileSync(output).equals(fs.readFileSync(path.join(web, 'engine.js'))), 'stale served engine');
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
check('deployment configuration unchanged', () => {
  git('diff', '--exit-code', physiologyRef, '--', '.deploy', '.github/workflows', ':!.github/workflows/v16-ui-v24-physiology-guard.yml');
});
const bundle = fs.readFileSync(path.join(web, 'engine.js'), 'utf8');
check('v2.4 terminal-state implementation present', () => assert(bundle.includes('createV24TerminalStateController'), 'terminal-state implementation missing'));
const context = vm.createContext({ console });
vm.runInContext(bundle, context, { timeout: 10000 });
const VENT = context.VENT;
const worker = fs.readFileSync(path.join(web, 'clinical-worker.js'), 'utf8');
check('all frozen worker factory exports available', () => {
  const names = [...worker.matchAll(/VENT\.(\w+)\(/g)].map(match => match[1]);
  const missing = names.filter(name => typeof VENT[name] !== 'function');
  assert(!missing.length, 'missing ' + missing.join(', '));
});
const payload = {
  caseId: 'berlin-moderate-moderate-aspiration',
  ventilation: { mode: 'VC_AC', fio2: 0.5, peep: 8, rr: 20, vtL: 0.42, inspiratoryFlowLps: 0.7, inspiratoryPauseSec: 0 },
  initialRecruitmentState: { normal: 1, recruitable: 0.5, consolidated: 0 },
};
check('frozen worker default patient initializes', () => {
  const replies = [];
  const workerContext = vm.createContext({ console, self: { postMessage: reply => replies.push(reply) } });
  workerContext.importScripts = () => vm.runInContext(bundle, workerContext);
  vm.runInContext(worker, workerContext);
  workerContext.self.onmessage({ data: { type: 'initialize', provider: 'v16-integrated-ards', payload } });
  assert(replies[0]?.type === 'initialized', replies[0]?.message || 'no initialized message');
});
const live = VENT.createBerlinLiveHumModSession(payload);
const initial = live.initialize();
check('v2.4 live factory time advancement works independently', () => {
  assert(live.runFor(2).timeSec > initial.timeSec, 'time did not advance');
});
check('frozen UI required comparison contract', () => {
  const comparison = initial.systemic?.physicianComparison;
  const required = ['heartRatePerMin', 'meanArterialPressureMmHg', 'cardiacOutputMlPerMin', 'strokeVolumeMl', 'systemicPeripheralResistanceMmHgMinPerL'];
  assert(comparison?.candidateModel, 'systemic.physicianComparison.candidateModel missing');
  for (const key of required) assert(Number.isFinite(comparison.candidateModel[key]), 'invalid candidateModel.' + key);
  assert(Number.isFinite(comparison?.hummod2013Compensation?.heartRatePerMin), 'hummod2013Compensation.heartRatePerMin missing');
});
console.log('Integration failures: ' + failed);
process.exitCode = failed ? 1 : 0;

