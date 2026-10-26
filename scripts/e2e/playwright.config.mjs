import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { CFG, ROOT } from './env.mjs';

const reports = path.join(ROOT, 'reports');

export default defineConfig({
  testDir: path.join(ROOT, 'scripts', 'e2e', 'tests'),
  testMatch: '**/*.spec.mjs',
  outputDir: path.join(reports, 'playwright', 'artifacts'),
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.E2E_WORKERS ? Number(process.env.E2E_WORKERS) : 2,
  reporter: [['list'], ['html', { outputFolder: path.join(reports, 'playwright', 'html'), open: 'never' }]],
  use: {
    baseURL: CFG.baseURL || 'http://localhost:9292',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
  },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox-desktop', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit-desktop', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-iphone13', use: { ...devices['iPhone 13'] } },
    { name: 'mobile-pixel7', use: { ...devices['Pixel 7'] } },
  ],
});
