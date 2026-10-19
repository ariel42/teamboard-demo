import { randomBytes } from 'node:crypto';
import { defineConfig, devices } from '@playwright/test';

// One throwaway schema set per run. Set once in the main process; workers inherit it. It is a
// dedicated variable so a DB_SCHEMA_PREFIX exported in your shell is never used (or dropped).
process.env.E2E_SCHEMA_PREFIX ??= `e2e_${randomBytes(4).toString('hex')}_`;
process.env.DB_SCHEMA_PREFIX = process.env.E2E_SCHEMA_PREFIX;

// 5173 / 3000 are the defaults; the overrides exist for hosts where those ports are taken.
const webPort = Number(process.env.WEB_PORT ?? 5173);
const apiPort = Number(process.env.API_PORT ?? 3000);

export default defineConfig({
  testDir: './e2e',
  globalTeardown: './e2e/global-teardown.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  use: {
    baseURL: `http://localhost:${webPort}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    reducedMotion: 'reduce',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // Real API against real Postgres: migrate + seed the per-run schemas, then serve.
      command: 'npm run db:setup && npm run start -w @teamboard/api',
      cwd: '../..',
      url: `http://localhost:${apiPort}/api/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...(process.env as Record<string, string>),
        PORT: String(apiPort),
        DEVENV_KIND: 'e2e',
        DEVENV_USER: 'playwright',
      },
    },
    {
      command: 'npm run dev -w @teamboard/web',
      cwd: '../..',
      url: `http://localhost:${webPort}`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...(process.env as Record<string, string>),
        WEB_PORT: String(webPort),
        API_PORT: String(apiPort),
      },
    },
  ],
});
