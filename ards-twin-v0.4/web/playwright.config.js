// playwright.config.js — ARDS v0.4.2 browser UI smoke tests.
// Runs against the deployed site at vent.defying-logic.com.
// Override the base URL with `BASE_URL=... npx playwright test`.

import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

// Look for an installed Chromium that the bundled Playwright version may
// not match exactly. We search ms-playwright cache for any chrome-mac-arm64
// binary that's on disk, falling back to the bundled one.
function findChromePath() {
  const cache = path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright');
  if (!fs.existsSync(cache)) return undefined;
  const dirs = fs.readdirSync(cache)
    .filter(d => /^chromium-\d+$/.test(d))
    .sort()
    .reverse();
  for (const d of dirs) {
    const bin = path.join(cache, d, 'chrome-mac-arm64',
      'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing');
    if (fs.existsSync(bin)) return bin;
  }
  return undefined;
}

const chromePath = findChromePath();

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.js$/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL || 'https://vent.defying-logic.com',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    timeout: 30_000,
    ...(chromePath ? { launchOptions: { executablePath: chromePath } } : {}),
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
