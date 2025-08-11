import { defineConfig, devices } from '@playwright/test';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  /* Run tests in files in parallel - optimized for performance */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Increased retries for better reliability */
  retries: process.env.CI ? 3 : 2,
  /* Optimized worker configuration for better resource management */
  workers: process.env.CI ? 2 : Math.min(4, Math.ceil(require('os').cpus().length / 2)),
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
    ['junit', { outputFile: 'test-results/junit.xml' }]
  ],
  /* Optimized timeout for faster feedback */
  timeout: 45000, // Reduced from 60s to 45s
  /* Expect timeout for assertions */
  expect: {
    timeout: 8000 // Reduced from 10s to 8s
  },
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'https://osvm.ai',

    /* Optimized trace collection for better performance */
    trace: 'retain-on-failure',

    /* Screenshot on failure */
    screenshot: 'only-on-failure',

    /* Video recording - optimized for performance */
    video: 'retain-on-failure',

    /* Optimized action timeout for faster feedback */
    actionTimeout: 12000, // Reduced from 15s to 12s

    /* Optimized navigation timeout */
    navigationTimeout: 20000, // Reduced from 30s to 20s

    /* Additional performance optimizations */
    launchOptions: {
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--memory-pressure-off',
        '--max_old_space_size=4096'
      ]
    },

    /* Viewport size for consistent testing */
    viewport: { width: 1280, height: 720 },

    /* Ignore HTTPS errors for test environment */
    ignoreHTTPSErrors: true,

    /* Reduce resource usage */
    bypassCSP: true,

    /* Set environment variable for test detection */
    extraHTTPHeaders: {
      'X-Playwright-Test': 'true'
    }
  },

  /* Configure projects for major browsers with performance optimizations */
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-features=TranslateUI',
            '--disable-ipc-flooding-protection',
            '--memory-pressure-off',
            '--max_old_space_size=4096',
            '--disable-extensions',
            '--disable-plugins',
            '--disable-images', // Faster loading in tests
            '--headless=new'
          ]
        }
      },
    },

    // Firefox disabled due to Flatpak environment compatibility issues
    // {
    //   name: 'firefox',
    //   use: {
    //     ...devices['Desktop Firefox'],
    //     launchOptions: {
    //       firefoxUserPrefs: {
    //         'dom.disable_beforeunload': true,
    //         'browser.tabs.animate': false,
    //         'browser.fullscreen.animate': false,
    //         'toolkit.cosmeticAnimations.enabled': false,
    //         'layers.acceleration.disabled': false,
    //         'gfx.canvas.accelerated': true,
    //         'image.animation_mode': 'none'
    //       }
    //     }
    //   },
    // },

    // WebKit disabled due to missing system libraries in Flatpak environment
    // {
    //   name: 'webkit',
    //   use: {
    //     ...devices['Desktop Safari'],
    //     // Webkit doesn't support common browser launch arguments
    //     // Keep configuration minimal for maximum compatibility
    //   },
    // },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests - optimized */
  // Disabled webServer here to allow running tests against an already running server
  // Start the server separately with `npm run start` before running Playwright tests
  // webServer: {
  //   command: 'npm run build && npm run start',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120 * 1000,
  //   stdout: 'pipe',
  //   stderr: 'pipe',
  //   env: {
  //     NODE_ENV: 'test',
  //     NEXT_TELEMETRY_DISABLED: '1',
  //     DISABLE_ANALYTICS: 'true',
  //     DISABLE_TRACKING: 'true'
  //   }
  // },

  /* Global setup and teardown for better resource management */
  globalSetup: require.resolve('./e2e/global-setup.ts'),
  globalTeardown: require.resolve('./e2e/global-teardown.ts'),

  /* Output directory for test results */
  outputDir: 'test-results/',

  /* Metadata for better reporting */
  metadata: {
    cpu: require('os').cpus()[0].model,
    memory: `${Math.round(require('os').totalmem() / 1024 / 1024 / 1024)}GB`,
  },
});
