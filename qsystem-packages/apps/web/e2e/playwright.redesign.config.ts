import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PLAYWRIGHT_PORT || 3100);
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${PORT}`;
const useProdServer = process.env.PLAYWRIGHT_USE_PROD_SERVER === '1';

export default defineConfig({
  testDir: '.',
  testMatch: /redesign-e2e\.spec\.ts/,
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: useProdServer
          ? `corepack pnpm exec next start --port ${PORT}`
          : `corepack pnpm exec next dev --turbopack --port ${PORT}`,
        url: `http://127.0.0.1:${PORT}/login`,
        cwd: path.resolve(__dirname, '..'),
        reuseExistingServer: false,
        timeout: 120_000,
      },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
