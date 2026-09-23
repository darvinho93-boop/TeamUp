import { defineConfig, devices } from '@playwright/test';

// Port à part : les tests tournent sur un build de production, jamais sur le serveur de dev
// (compilation à la volée, React en mode développement) qui fausserait les mesures de latence.
const PORT = 3100;

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
    command: `pnpm exec next build && pnpm exec next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/partie/FETE24`,
    reuseExistingServer: !process.env['CI'],
    timeout: 300_000,
  },
});
