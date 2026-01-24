import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Quorum SQL E2E tests
 *
 * Test Isolation Strategy:
 * - Each test file runs in parallel (separate workers)
 * - Tests within a file can be serial (via test.describe.configure)
 * - Each test uses unique users (generateTestUser) for DB isolation
 * - No shared database state between test files
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',

  // Enable parallelism at file level
  // Tests within a file using test.describe.configure({ mode: 'serial' })
  // will still run sequentially
  fullyParallel: true,

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,

  // Multiple workers for parallel test files
  // Each worker gets its own browser context and unique test users
  workers: process.env.CI ? 2 : 4,

  reporter: [
    ['html'],
    ['line'],
    ...(process.env.CI || process.env.PLAYWRIGHT_JSON === '1'
      ? [['json', { outputFile: 'test-results/playwright.json' }] as const]
      : []),
  ],

  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:8080',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Run local dev server before tests if not in CI
  webServer: process.env.CI ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
