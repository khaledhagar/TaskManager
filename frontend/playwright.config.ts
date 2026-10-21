import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests against the built frontend served by FastAPI (`npm run build` first).
 * `e2e/server.py` starts the app on a fresh database with a fake Google provider.
 * Live AI tests are tagged @live and skipped unless LIVE=1 (they use the free daily quota).
 * Firefox and WebKit run the @smoke tests only (T-355).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: 4,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  grepInvert: process.env.LIVE ? undefined : /@live/,
  use: {
    baseURL: 'http://127.0.0.1:8001',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'edge', use: { ...devices['Desktop Edge'], channel: 'msedge' } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, grep: /@smoke/ },
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, grep: /@smoke/ },
  ],
  webServer: {
    command: 'uv run python ../frontend/e2e/server.py',
    cwd: '../backend',
    url: 'http://127.0.0.1:8001/api/health',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
