import { defineConfig } from '@playwright/test';
import { join } from 'node:path';

const configDir = __dirname;
const repoRoot = join(configDir, '..');
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: join(configDir, 'specs'),
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 2 : undefined,
  timeout: 30_000,
  expect: {
    timeout: 7_500,
  },
  reporter: [
    ['list'],
    ['html', { outputFolder: join(repoRoot, 'playwright-report'), open: 'never' }],
  ],
  outputDir: join(repoRoot, 'test-results'),
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'mobile-390x844',
      use: {
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'mobile-412x915',
      use: {
        viewport: { width: 412, height: 915 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: 'node scripts/e2e-server.mjs',
    cwd: repoRoot,
    url: 'http://127.0.0.1:4173/health',
    reuseExistingServer: !isCI,
    timeout: 300_000,
  },
});
