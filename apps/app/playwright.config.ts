import { defineConfig, devices } from '@playwright/test';

const PORT = 3000;

/**
 * Parcours critiques de l'app, dans un vrai navigateur, contre la base locale
 * (`pnpm db:start`). Un seul worker : les specs écrivent dans la même base.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  forbidOnly: !!process.env['CI'],
  reporter: process.env['CI'] ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'mobile', use: { ...devices['Pixel 7'] } }],
  webServer: {
    command: `pnpm exec next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/api/partie/FETE24`,
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
});
