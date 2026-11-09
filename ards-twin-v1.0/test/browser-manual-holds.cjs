'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { chromium } = require('playwright');

(async () => {
  let server, browser;
  try {
    if (!process.env.BASE_URL) {
    server = spawn(process.execPath, ['scripts/serve.js'], {
      cwd: path.resolve(__dirname, '..'), stdio: ['ignore', 'pipe', 'inherit'],
    });
    let timer;
    try {
      await Promise.race([
        once(server.stdout, 'data'),
        once(server, 'exit').then(() => { throw new Error('preview server exited'); }),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('server startup timed out')), 10000); }),
      ]);
    } finally { clearTimeout(timer); }
    }
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8765/');
    await page.waitForFunction(() => !document.querySelector('#clinical-initialize').disabled);
    await page.locator('#clinical-quick-start').click();
    await page.waitForFunction(() => document.querySelector('#clinical-time').textContent.trim() === '0');

    async function value(id) { return (await page.locator('#' + id).textContent()).trim(); }
    async function settings(fio2, peep, rr) {
      await page.locator('.servo-nav [data-panel="settings"]').click();
      await page.locator('#clinical-fio2').fill(String(fio2));
      await page.locator('#clinical-peep').fill(String(peep));
      await page.locator('#clinical-rr').fill(String(rr));
      await page.locator('#clinical-apply-vent').click();
      await page.locator('#servo-settings-panel [data-close-panel]').click();
    }
    async function advance(seconds) {
      await page.locator('.servo-nav [data-panel="clock"]').click();
      const before = Number(await value('clinical-time'));
      await page.locator('#clinical-run-seconds').fill(String(seconds));
      await page.locator('#clinical-run').click();
      await page.waitForFunction(({ before, seconds }) => {
        const error = document.querySelector('#clinical-session-error');
        return (!error.hidden && error.textContent.trim()) ||
          Number(document.querySelector('#clinical-time').textContent) >= before + seconds - 1e-6;
      }, { before, seconds }, { timeout: 120000 });
      assert.equal((await page.locator('#clinical-session-error').textContent()).trim(), '');
      await page.locator('dialog[open] [data-close-panel]').click();
    }
    async function hold(id) {
      await page.locator('.servo-nav [data-panel="holds"]').click();
      const before = Number(await value('clinical-time'));
      await page.locator('#' + id).click();
      await page.waitForFunction(({ before, id }) => {
        const error = document.querySelector('#clinical-session-error');
        return (!error.hidden && error.textContent.trim()) ||
          (!document.querySelector('#' + id).disabled &&
            Number(document.querySelector('#clinical-time').textContent) > before);
      }, { before, id }, { timeout: 120000 });
      assert.equal((await page.locator('#clinical-session-error').textContent()).trim(), '');
      await page.locator('dialog[open] [data-close-panel]').click();
    }

    await settings(0.30, 3, 4);
    await advance(100);
    assert(Number(await value('clinical-hr')) > 0);
    await hold('clinical-insp-hold');
    await hold('clinical-exp-hold');
    assert(Number.isFinite(Number(await value('clinical-dp'))));

    await settings(0.60, 8, 20);
    await advance(20);
    assert.equal(await value('clinical-pplat'), '—', 'old plateau must be unavailable after settings change');
    assert.equal(await value('clinical-dp'), '—', 'old driving pressure must be unavailable');
    await hold('clinical-insp-hold');
    assert(Number.isFinite(Number(await value('clinical-pplat'))));
    assert.equal(await value('clinical-dp'), '—', 'new plateau cannot use old low-PEEP hold');
    await hold('clinical-exp-hold');
    const plateau = Number(await value('clinical-pplat'));
    const driving = Number(await value('clinical-dp'));
    const result = await value('clinical-maneuver-result');
    const measured = result.match(/Total PEEP ([\d.eE+-]+) cmH₂O/);
    assert(measured, 'completed expiratory hold must report measured total PEEP: ' + result);
    const totalPeep = Number(measured[1]);
    const reference = Math.max(8, totalPeep, 4);
    assert(Math.abs(plateau - reference - driving) < 1e-8,
      JSON.stringify({ plateau, driving, totalPeep, reference }));
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ workflow: 'manual transition, recovery, current hold pairing', plateau, driving, totalPeep, errors }));
  } finally {
    if (browser) await browser.close();
    if (server) server.kill();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
