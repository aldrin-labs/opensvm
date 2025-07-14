import { PlaywrightTestConfig, devices } from '@playwright/test';

const config: PlaywrightTestConfig = {
  testDir: './e2e',
  timeout: 30000,
  expect: {
    timeout: 5000
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    actionTimeout: 0,
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    // Desktop browsers
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1280, height: 800 },
      },
    },

    // Mobile devices
    {
      name: 'iPhone 12',
      use: {
        ...devices['iPhone 12'],
      },
    },
    {
      name: 'Pixel 5',
      use: {
        ...devices['Pixel 5'],
      },
    },

    // Tablet devices
    {
      name: 'iPad Pro',
      use: {
        ...devices['iPad Pro 11'],
      },
    },
    {
      name: 'Galaxy Tab S7',
      use: {
        ...devices['Galaxy Tab S7'],
        viewport: { width: 1600, height: 2560 },
        deviceScaleFactor: 2,
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: true,
  },
};

export default config;
