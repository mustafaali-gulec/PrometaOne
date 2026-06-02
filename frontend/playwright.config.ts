/**
 * Playwright config — Faz 4-bis E2E akışları.
 *
 * Gereksinimler:
 *   - Docker daemon ayakta (testcontainers PG için).
 *   - api-server `npm run dev` lokal portta (default 3000).
 *   - frontend `npm run dev` lokal portta (default 5173).
 *
 * E2E suite ENV ile mod seçer:
 *   - PROMETA_E2E_BASE_URL=http://localhost:5173   (default)
 *   - PROMETA_E2E_API_URL=http://localhost:3000    (default)
 *   - PROMETA_E2E_AUTH_TOKEN=...                   (login flow yok ise direkt token)
 *
 * Setup şu an "lokal stack zaten ayakta" varsayar. CI integration için
 * webServer block'u açılabilir (yorum satırlı bırakıldı).
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // shared DB state, sequential daha güvenli
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.PROMETA_E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // CI'de full stack başlatma için açılabilir:
  // webServer: [
  //   {
  //     command: 'cd ../api-server && npm run dev',
  //     port: 3000,
  //     reuseExistingServer: !process.env.CI,
  //     timeout: 60_000,
  //   },
  //   {
  //     command: 'npm run dev',
  //     port: 5173,
  //     reuseExistingServer: !process.env.CI,
  //     timeout: 30_000,
  //   },
  // ],
});
