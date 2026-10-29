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
for (const file of ['styles.css', 'native-engine-client.js', 'native-engine-config.js']) {
  check('frozen v1.6 ' + file, () => assert(
    fs.readFileSync(path.join(web, file)).equals(git('show', uiRef + ':ards-twin-v1.0/web/' + file)),
    'differs from pinned v1.6 source'));
}
// Only version text, supported-provider wiring and availability attributes changed.
// Protect the established elements, control IDs, ordering and CSS classes.
check('v1.6 bedside layout and control structure preserved', () => {
  const structure = html => [...html.matchAll(/<([a-z][a-z0-9:-]*)\b([^>]*)>/gi)].map(match => {
    const id = match[2].match(/\bid="([^"]*)"/)?.[1];
    return [match[1].toLowerCase(), id === 'clinical-boundary-note' ? null : id || null,
      match[2].match(/\bclass="([^"]*)"/)?.[1] || null];
  });
  const original = git('show', uiRef + ':ards-twin-v1.0/web/index.html').toString();
  const current = fs.readFileSync(path.join(web, 'index.html'), 'utf8');
  assert(JSON.stringify(structure(original)) === JSON.stringify(structure(current)), 'bedside structure changed');
  assert(current.includes('<title>ARDS Clinical Twin · v2.4</title>') && current.includes('<span>v2.4</span>'), 'incorrect visible version');
});
check('v2.4 sources retain only audited hold-scheduling fixes', () => {
  git('diff', '--exit-code', physiologyRef, '--', 'ards-twin-v0.5-progress/src',
    ':!ards-twin-v0.5-progress/src/simulation.js', ':!ards-twin-v0.5-progress/src/clinical_twin_live_hummod_session.js');
  const hashes = {'simulation.js': 'f6cbbc58d97b31feea7970b14c6625e3f4f5cb6076b1083316c04d69e30a467e', 'clinical_twin_live_hummod_session.js': 'b52e1c296e9fbd2963c88a53dcd253cd813e2cdc70bf0283d564fe42ec091759'};
  for (const [file, expected] of Object.entries(hashes)) {
    const actual = require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(root, 'ards-twin-v0.5-progress/src', file))).digest('hex');
    assert(actual === expected, 'unexpected changes in audited scheduling module ' + file);
  }
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
check('all integration worker factory exports available', () => {
  const names = [...worker.matchAll(/VENT\.(\w+)\(/g)].map(match => match[1]);
  const missing = names.filter(name => typeof VENT[name] !== 'function');
  assert(!missing.length, 'missing ' + missing.join(', '));
});
const payload = {
  caseId: 'berlin-moderate-moderate-aspiration',
  ventilation: { mode: 'VC_AC', fio2: 0.5, peep: 8, rr: 20, vtL: 0.42, inspiratoryFlowLps: 0.7, inspiratoryPauseSec: 0 },
  initialRecruitmentState: { normal: 1, recruitable: 0.5, consolidated: 0 },
};
check('v2.4 worker default patient initializes', () => {
  const replies = [];
  const workerContext = vm.createContext({ console, self: { postMessage: reply => replies.push(reply) } });
  workerContext.importScripts = () => vm.runInContext(bundle, workerContext);
  vm.runInContext(worker, workerContext);
  workerContext.self.onmessage({ data: { type: 'initialize', provider: 'live-reduced-hummod', payload } });
  assert(replies[0]?.type === 'initialized', replies[0]?.message || 'no initialized message');
});
const live = VENT.createBerlinLiveHumModSession(payload);
const initial = live.initialize();
check('v2.4 live factory time advancement works independently', () => {
  assert(live.runFor(2).timeSec > initial.timeSec, 'time did not advance');
});
check('UI validates actual v2.4 snapshot fields', () => {
  const app = fs.readFileSync(path.join(web, 'app.js'), 'utf8');
  const validation = app.slice(app.indexOf('  function requireClinicalSnapshot('), app.indexOf('  async function pollNativeEngineBoundary()'));
  const validate = vm.runInNewContext(validation + '\nrequireClinicalSnapshot');
  validate(initial);
  let rejected = false;
  try { validate({ ...initial, systemic: { ...initial.systemic, hemodynamics: {} } }); }
  catch { rejected = true; }
  assert(rejected, 'invalid live hemodynamics were accepted');
  assert(!initial.systemic.physicianComparison, 'must not fabricate missing comparison models');
});
check('v2.4 state-preserving ventilation changes and holds', () => {
  const time = live.snapshot().timeSec;
  live.requestVentilationChange({ ...payload.ventilation, peep: 10, fio2: 0.7, rr: 22, vtL: 0.4 });
  const next = live.runFor(10);
  assert(next.timeSec > time, 'clock reset');
  assert(next.ventilator.peepCmH2O === 10 && next.ventilator.fio2 === 0.7 && next.ventilator.rrPerMin === 22 && next.ventilator.vtL === 0.4, 'settings did not apply');
  const held = live.performPassiveMechanicsMeasurement({ holdDurationSec: 0.5, maxAdvanceSecPerHold: 90 });
  assert(held.timeSec > next.timeSec, 'holds did not advance patient time');
  assert(Number.isFinite(held.pulmonary.measurements.plateauPressureCmH2O), 'hold plateau unavailable');
});
console.log('Integration failures: ' + failed);
process.exitCode = failed ? 1 : 0;
