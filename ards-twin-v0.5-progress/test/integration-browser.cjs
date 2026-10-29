'use strict';

// Exercises the served bedside UI and its real worker, without mocking physiology.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const playwright = require('playwright');
const root = path.resolve(__dirname, '../..');
const web = path.join(root, 'ards-twin-v1.0/web');
const results = path.resolve(process.env.INTEGRATION_RESULTS_DIR || path.join(__dirname, '../browser-results/integration'));
const browserName = process.env.BROWSER || 'chromium';
const checks = [];
let browser;
let server;
function pass(name) { checks.push(name); console.log('ok - ' + name); }
async function startServer() {
  const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json' };
  server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const file = path.resolve(web, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(web + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (error, data) => {
      if (error) { res.writeHead(404).end(); return; }
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'text/plain', 'Cache-Control': 'no-store' });
      res.end(data);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return 'http://127.0.0.1:' + server.address().port + '/';
}
async function main() {
  fs.mkdirSync(results, { recursive: true });
  const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const workingTreeDirty = Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim());
  const url = process.env.BASE_URL || await startServer();
  browser = await playwright[browserName].launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true });
  // The native endpoint is a separate read-only shadow. Keep this local test
  // independent of its availability; the browser worker remains authoritative.
  await context.route('https://engine.hummod.defying-logic.com/**', route => route.abort());
  await context.addInitScript(() => {
    window.__clinicalMessages = [];
    const RealWorker = window.Worker;
    window.Worker = class extends RealWorker {
      constructor(url, options) {
        super(url, options);
        if (String(url).includes('clinical-worker.js')) {
          this.addEventListener('message', event => window.__clinicalMessages.push(event.data));
        }
      }
    };
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.setDefaultTimeout(30000);
  async function action(selector, expected) {
    const before = await page.evaluate(() => window.__clinicalMessages.length);
    await page.locator(selector).click();
    await page.waitForFunction(count => window.__clinicalMessages.length > count, before);
    const reply = await page.evaluate(() => window.__clinicalMessages.at(-1));
    assert.notEqual(reply.type, 'error', reply.message);
    assert.equal(reply.action || reply.type, expected);
    assert.equal(await page.locator('#clinical-session-error').isVisible(), false,
      await page.locator('#clinical-session-error').textContent());
    return reply.snapshot;
  }
  async function finiteMonitor(snapshot) {
    const fields = { 'clinical-hr': snapshot.systemic.hemodynamics.heartRatePerMin,
      'clinical-map': snapshot.systemic.hemodynamics.meanArterialPressureMmHg,
      'clinical-pao2': snapshot.systemic.gasExchange.pao2MmHg,
      'clinical-paco2': snapshot.systemic.gasExchange.paco2MmHg };
    for (const [id, value] of Object.entries(fields)) {
      assert(Number.isFinite(value), id + ' not finite');
      assert.equal(await page.locator('#' + id).textContent(), String(Math.round(value)));
    }
  }
  await page.goto(url);
  await page.waitForFunction(() => !document.getElementById('clinical-initialize').disabled);
  assert.equal(await page.title(), 'ARDS Clinical Twin · v2.4');
  assert.equal(await page.locator('.eyebrow span').textContent(), 'v2.4');
  assert.equal(await page.locator('#clinical-systemic-provider').inputValue(), 'live-reduced-hummod');
  pass('correct v2.4 identity and actual live provider selected');
  assert(await page.locator('#clinical-anatomic-shunt').isDisabled());
  assert(await page.locator('#clinical-excess-lung-water').isDisabled());
  assert((await page.locator('#clinical-boundary-note').textContent()).includes('unavailable'));
  assert(await page.locator('#clinical-mode option[value="PC_AC"]').isDisabled());
  pass('unsupported candidate inputs and live PC-AC explicitly disabled');
  let snapshot = await action('#clinical-initialize', 'initialized');
  assert.equal(snapshot.timeSec, 1);
  assert.equal(snapshot.coupling.mode, 'live-reduced-hummod-ards-core');
  assert.equal(snapshot.systemic.physicianComparison, undefined);
  await finiteMonitor(snapshot);
  assert(Number.isFinite(Number(await page.locator('#clinical-ppeak').textContent())));
  pass('Start patient succeeds with real finite monitor values');
  await page.locator('#clinical-run-seconds').fill('30');
  snapshot = await action('#clinical-run', 'runFor');
  assert.equal(snapshot.timeSec, 31);
  await finiteMonitor(snapshot);
  assert(await page.locator('#clinical-pressure-chart path.trace').count() > 0);
  assert(await page.locator('#clinical-pao2-trend path').count() > 0);
  pass('fixed advancement updates patient clock, physiology and charts');
  const priorTime = snapshot.timeSec;
  const priorVolume = snapshot.pulmonary.totalLungVolumeL;
  for (const [id, value] of Object.entries({ 'clinical-peep': '10', 'clinical-fio2': '0.70', 'clinical-rr': '22', 'clinical-vt': '0.40', 'clinical-flow': '0.8', 'clinical-vc-pause': '0' })) {
    await page.locator('#' + id).fill(value);
  }
  snapshot = await action('#clinical-apply-vent', 'requestVentilationChange');
  assert.equal(snapshot.timeSec, priorTime);
  assert.equal(snapshot.pulmonary.totalLungVolumeL, priorVolume);
  assert.equal(snapshot.ventilatorChangePending, true);
  snapshot = await action('#clinical-run', 'runFor');
  assert.equal(snapshot.timeSec, priorTime + 30);
  assert.equal(snapshot.ventilator.peepCmH2O, 10);
  assert.equal(snapshot.ventilator.fio2, 0.7);
  assert.equal(snapshot.ventilator.rrPerMin, 22);
  assert.equal(snapshot.ventilator.vtL, 0.4);
  assert.equal(snapshot.ventilator.inspiratoryFlowLps, 0.8);
  assert.equal(snapshot.ventilator.inspiratoryPauseSec, 0);
  assert.equal(snapshot.ventilatorChangePending, false);
  await finiteMonitor(snapshot);
  pass('PEEP, FiO2, RR, tidal volume, flow and pause apply without resetting patient');
  snapshot = await action('#clinical-insp-hold', 'requestInspiratoryHold');
  assert(Number.isFinite(snapshot.pulmonary.measurements.plateauPressureCmH2O));
  assert(Math.abs(snapshot.pulmonary.measurements.inspiratoryHold.medianLateAirwayFlowLps) < 1e-8);
  pass('inspiratory hold works with zero pause after a ventilator change');
  snapshot = await action('#clinical-exp-hold', 'requestExpiratoryHold');
  assert(Number.isFinite(snapshot.pulmonary.measurements.totalPeepCmH2O));
  pass('expiratory hold completes and updates total PEEP');
  await page.locator('.clinical-advanced-actions').evaluate(element => { element.open = true; });
  snapshot = await action('#clinical-measure-mechanics', 'performPassiveMechanics');
  assert.equal(snapshot.pulmonary.measurements.status, 'derived-from-explicit-zero-flow-holds');
  await finiteMonitor(snapshot);
  pass('combined holds complete with both mechanics measurements');
  await page.locator('#clinical-speed').selectOption('2');
  const startContinuousTime = snapshot.timeSec;
  await page.locator('#clinical-run-continuous').click();
  await page.waitForFunction(t => Number(document.getElementById('clinical-time').textContent) >= t + 3, startContinuousTime);
  await page.locator('#clinical-pause-continuous').click();
  await page.waitForTimeout(250); // Drain an already dispatched worker step.
  const pausedTime = await page.locator('#clinical-time').textContent();
  await page.waitForTimeout(800);
  assert.equal(await page.locator('#clinical-time').textContent(), pausedTime);
  pass('continuous run, 2x speed and pause preserve a stable paused clock');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#clinical-export-session').click();
  const download = await downloadPromise;
  const exportPath = path.join(results, browserName + '-session.json');
  await download.saveAs(exportPath);
  const exported = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
  assert.equal(exported.physiologyVersion, '2.4');
  assert.equal(exported.physiologySourceSha, '0c52dd1b575f283126bafe4bf935b36da883ea0b');
  assert.equal(exported.timeSec, Number(pausedTime));
  assert(exported.interventions.length > 0 && exported.physiologyTrend.length > 1);
  assert(Number.isFinite(exported.hemodynamics.cardiacOutputMlPerMin));
  pass('session export includes real physiology, intervention history and v2.4 provenance');
  await page.locator('#clinical-live').screenshot({ path: path.join(results, browserName + '-monitor.png') });
  await page.locator('#clinical-reset').click();
  await page.waitForFunction(() => document.getElementById('clinical-live').hidden);
  assert.equal(await page.locator('#clinical-rr').inputValue(), '22');
  snapshot = await action('#clinical-initialize', 'initialized');
  assert.equal(snapshot.timeSec, 1);
  assert.equal(snapshot.ventilator.rrPerMin, 22);
  pass('reset and manual restart work with preserved settings');
  snapshot = await action('#clinical-quick-start', 'initialized');
  assert.equal(snapshot.ventilator.rrPerMin, 20);
  assert.equal(snapshot.timeSec, 1);
  pass('quick start safely replaces an existing session');
  await page.locator('#clinical-reset').click();
  await page.waitForFunction(() => document.getElementById('clinical-live').hidden);
  await page.setViewportSize({ width: 390, height: 844 });
  snapshot = await action('#clinical-quick-start', 'initialized');
  await finiteMonitor(snapshot);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.screenshot({ path: path.join(results, browserName + '-mobile.png'), fullPage: true });
  pass('mobile start and monitor fit a 390px viewport');
  await page.locator('#clinical-reset').click();
  await page.waitForFunction(() => document.getElementById('clinical-live').hidden);
  await page.locator('.engineering-provider').evaluate(element => { element.open = true; });
  await page.locator('#clinical-systemic-provider').selectOption('replay');
  await page.locator('#clinical-load-demo').click();
  const replay = await action('#clinical-initialize', 'initialized');
  assert.equal(replay.sessionSchema, 'berlin-clinical-twin-session/v1');
  await page.locator('#clinical-run-seconds').fill('2');
  const advancedReplay = await action('#clinical-run', 'runFor');
  assert(advancedReplay.timeSec > replay.timeSec);
  pass('explicit synthetic trajectory replay still initializes and advances');
  assert.deepEqual(pageErrors, []);
  assert.equal(await page.locator('#clinical-session-error').isVisible(), false);
  pass('no uncaught browser errors or session errors in tested workflows');
  fs.writeFileSync(path.join(results, browserName + '-results.json'), JSON.stringify({ sourceCommit, workingTreeDirty, browser: browserName, version: browser.version(), success: true, checks, finalSnapshot: snapshot }, null, 2) + '\n');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
});
