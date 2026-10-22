import { defineConfig, devices } from '@playwright/test'

/**
 * Smoke tests against the deployed site (Phase 28): `npm run e2e:live`.
 * Guests only (no emails are sent) and each test deletes its guest; guests are limited to 5 per hour per IP.
 */
export default defineConfig({
  testDir: './e2e-live',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: process.env.LIVE_URL ?? 'https://task-manager-opal-xi-63.vercel.app',
    ...devices['Desktop Edge'],
    channel: 'msedge',
  },
})
