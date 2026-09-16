// ui.spec.js — End-to-end smoke tests for the ARDS v0.4.2 browser UI.
//
// Validates:
//   - Page loads and the bundle responds 200.
//   - Default auto-run populates all metric tiles with finite numbers.
//   - SVG waveform paths render (Paw + Volume).
//   - Recruitment bars are drawn for all three compartments.
//   - Preset switch (Baseline → phenotype_high_recruitability) changes the metrics.
//   - Run button toggles disabled state and re-runs cleanly.
//   - Solver diagnostics show zero failures on a healthy run.

import { test, expect } from '@playwright/test';

const BASE = process.env.BASE_URL || 'https://vent.defying-logic.com';
// If BASE points to the web/ directory (local server use), use it directly.
// Otherwise (Cloudflare deployment), append /ards-twin-v0.4/web/.
const URL = /\/(ards-twin-v0\.4\/web|web)\/?$/.test(BASE)
  ? BASE.replace(/\/?$/, '/')
  : `${BASE.replace(/\/$/, '')}/ards-twin-v0.4/web/`;

test.describe('ARDS v0.4.2 browser UI', () => {
  test('page loads with bundle and CSS', async ({ page }) => {
    const resp = await page.goto(URL);
    expect(resp?.status(), 'page should return 200').toBe(200);
    // Bundle must be reachable.
    const bundle = await page.request.get(URL + 'ards-v042.bundle.js');
    expect(bundle.status(), 'bundle should return 200').toBe(200);
    // Title and headline.
    await expect(page).toHaveTitle(/ARDS Digital Twin v0\.4\.2/);
    await expect(page.locator('header h1')).toContainText('ARDS Digital Twin v0.4.2');
  });

  test('default auto-run populates metric tiles', async ({ page }) => {
    await page.goto(URL);
    // Default settings auto-run on DOMContentLoaded — wait for the run
    // button to become enabled again (it disables during run).
    await expect(page.locator('#run')).toBeEnabled({ timeout: 15_000 });
    // Wait for metrics to populate (run is async; small extra delay).
    await page.waitForFunction(
      () => document.getElementById('m-ppeak')?.textContent !== '—',
      { timeout: 15_000 });
    // Metrics should now be finite numbers, not the placeholder '—'.
    for (const id of ['m-ppeak', 'm-pplat', 'm-vti', 'm-vte',
                      'm-dp', 'm-rr', 'm-mv', 'm-tv']) {
      const txt = await page.locator('#' + id).textContent();
      expect(txt, `${id} should be a number`).not.toBe('—');
      const parsed = parseFloat(txt);
      expect(Number.isFinite(parsed), `${id} should be finite, got "${txt}"`)
        .toBe(true);
    }
    // Clinically plausible ranges for Baseline default (PEEP=5, Vt=0.480).
    const ppeak = parseFloat(await page.locator('#m-ppeak').textContent());
    expect(ppeak).toBeGreaterThan(5);    // at least PEEP
    expect(ppeak).toBeLessThan(40);      // not absurd
    const pplat = parseFloat(await page.locator('#m-pplat').textContent());
    expect(pplat).toBeGreaterThan(4);
    expect(pplat).toBeLessThan(ppeak);
    const vti = parseFloat(await page.locator('#m-vti').textContent());
    expect(vti).toBeGreaterThan(0.3);    // we asked for 0.480
    expect(vti).toBeLessThan(0.55);
  });

  test('SVG waveform paths render', async ({ page }) => {
    await page.goto(URL);
    await expect(page.locator('#run')).toBeEnabled({ timeout: 15_000 });
    // Wait for the paw path to actually be drawn.
    await page.waitForFunction(
      () => (document.getElementById('paw-path')?.getAttribute('d') || '').length > 50,
      { timeout: 15_000 });
    // Paw path should have a non-trivial d attribute.
    const pawD = await page.locator('#paw-path').getAttribute('d');
    expect(pawD, 'paw path should be drawn').toBeTruthy();
    expect(pawD.length).toBeGreaterThan(50);
    // Volume path should also be drawn.
    const volD = await page.locator('#vol-path').getAttribute('d');
    expect(volD, 'vol path should be drawn').toBeTruthy();
    expect(volD.length).toBeGreaterThan(50);
    // No NaN/Infinity in either path.
    expect(pawD, 'paw path has no NaN').not.toContain('NaN');
    expect(volD, 'vol path has no NaN').not.toContain('NaN');
  });

  test('recruitment bars drawn for all three compartments', async ({ page }) => {
    await page.goto(URL);
    await expect(page.locator('#run')).toBeEnabled({ timeout: 15_000 });
    const bars = page.locator('.recruit-bar');
    await expect(bars).toHaveCount(3);
    // Each bar should have a label mentioning a compartment id.
    const labels = await bars.locator('.recruit-label').allTextContents();
    expect(labels.some(l => l.includes('normal'))).toBe(true);
    expect(labels.some(l => l.includes('recruitable'))).toBe(true);
    expect(labels.some(l => l.includes('consolidated'))).toBe(true);
  });

  test('switching to phenotype_high_recruitability produces different metrics', async ({ page }) => {
    await page.goto(URL);
    await expect(page.locator('#run')).toBeEnabled({ timeout: 15_000 });
    const baselinePpeak = parseFloat(await page.locator('#m-ppeak').textContent());
    const baselineVti = parseFloat(await page.locator('#m-vti').textContent());

    // Switch to phenotype_high_recruitability and re-run.
    await page.locator('#preset').selectOption('phenotype_high_recruitability');
    await page.locator('#peep').fill('14');
    await page.locator('#vt').fill('0.280');
    await page.locator('#rr').fill('26');
    await page.locator('#breaths').fill('3');
    await page.locator('#run').click();
    await expect(page.locator('#run')).toBeEnabled({ timeout: 15_000 });

    const injCPpeak = parseFloat(await page.locator('#m-ppeak').textContent());
    const injCVti = parseFloat(await page.locator('#m-vti').textContent());

    // phenotype_high_recruitability at PEEP=14, Vt=0.280 should produce a different (likely
    // higher) Ppeak than Baseline at PEEP=5, Vt=0.480 — the comparison
    // is qualitative.
    expect(injCPpeak).not.toBe(baselinePpeak);
    // Ppeak should be in a plausible ARDS range with PEEP=14.
    expect(injCPpeak).toBeGreaterThan(15);
    expect(injCPpeak).toBeLessThan(60);
    // Vt should be near what we asked for (within ±20%).
    expect(injCVti).toBeGreaterThan(0.20);
    expect(injCVti).toBeLessThan(0.40);
  });

  test('manual run button click works after default auto-run', async ({ page }) => {
    await page.goto(URL);
    await expect(page.locator('#run')).toBeEnabled({ timeout: 15_000 });
    // First auto-run completed. Click again — should re-run.
    await page.locator('#run').click();
    // During the run, the button should briefly show "Running..." and be disabled.
    // After it completes, it should be enabled again.
    await expect(page.locator('#run')).toBeEnabled({ timeout: 15_000 });
    // Metrics should still be valid.
    const ppeak = parseFloat(await page.locator('#m-ppeak').textContent());
    expect(Number.isFinite(ppeak)).toBe(true);
  });

  test('solver diagnostics show step count and zero failures on Baseline',
    async ({ page }) => {
    await page.goto(URL);
    await expect(page.locator('#run')).toBeEnabled({ timeout: 15_000 });
    // Open the diagnostics details.
    await page.locator('details summary:has-text("Solver diagnostics")').click();
    const diag = await page.locator('#diag').textContent();
    expect(diag, 'diag should mention step count').toMatch(/Steps:\s+\d+/);
    expect(diag, 'Baseline should have zero solver failures')
      .toMatch(/Solver failures:\s+0/);
    // Newton iters should be a small average (implicit solver converges fast).
    expect(diag).toMatch(/Newton iters:\s+avg=\d+\.\d{2}/);
  });

  test('compartment details populated', async ({ page }) => {
    await page.goto(URL);
    await expect(page.locator('#run')).toBeEnabled({ timeout: 15_000 });
    await page.locator('details summary:has-text("Compartment details")').click();
    const details = await page.locator('#comp-details').textContent();
    expect(details).toContain('normal');
    expect(details).toContain('recruitable');
    expect(details).toContain('consolidated');
    // Each line should mention a volume in liters.
    expect(details).toMatch(/V=\s*[\d.]+\s*L/);
  });
});
