import { defineConfig, devices } from '@playwright/test'

/**
 * Screenshots and the feature video for the documentation (Phase 29): `npm run docs:shots`, `npm run docs:video`.
 * Same local test server as the e2e tests (fresh database, emails kept in memory); real AI calls from `.env`.
 */
export default defineConfig({
  testDir: './e2e-docs',
  timeout: 15 * 60_000,
  expect: { timeout: 20_000 },
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:8001',
    ...devices['Desktop Edge'],
    channel: 'msedge',
    viewport: { width: 1440, height: 900 },
    colorScheme: 'light',
    locale: 'en-US',
    actionTimeout: 20_000,
  },
  webServer: {
    command: 'uv run python ../frontend/e2e/server.py',
    cwd: '../backend',
    url: 'http://127.0.0.1:8001/api/health',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
