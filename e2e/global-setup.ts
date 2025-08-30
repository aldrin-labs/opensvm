import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global test setup...');

  // Set up performance monitoring
  process.env.PLAYWRIGHT_PERFORMANCE_MODE = 'true';

  // Pre-warm the browser and ensure server is ready
  // Use chromium for global setup to avoid webkit-specific issues
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--memory-pressure-off'
    ]
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  // Determine baseURL preference order
  const configuredBase = (config.projects?.[0]?.use as any)?.baseURL as string | undefined;
  // Treat either PLAYWRIGHT_BASE_URL or BASE_URL as an explicit instruction not to fallback/port-scan
  const explicitBaseEnv = process.env.PLAYWRIGHT_BASE_URL || process.env.BASE_URL;
  let baseURL = explicitBaseEnv || configuredBase || 'https://osvm.ai';
  const isLocal = (url: string) => /localhost|127\.0\.0\.1/.test(url);

  // Wait for server to be ready with retries; auto-fallback from local to production if needed
  let retries = 15;
  let serverReady = false;
  let attemptedFallback = false;
  let fallbackIndex = 0;
  const localFallbacks = [
    (url: string) => url.replace(':3000', ':3001'),
    (url: string) => url.replace(':3000', ':3003')
  ];

  while (retries > 0 && !serverReady) {
    try {
      console.log(`Checking server readiness... (${retries} retries left)`);
      const response = await page.goto(baseURL, { timeout: 20000, waitUntil: 'domcontentloaded' });

      // Consider any successful navigation (even 404 pages) as server ready.
      // Next.js often serves 404 at '/', but the server is up.
      if (response) {
        const status = response.status();
        // If an explicit base URL is set to local, consider any HTTP status as reachable server
        if (explicitBaseEnv && isLocal(baseURL)) {
          serverReady = true;
          console.log(`✅ Server reachable at ${baseURL} (status ${status})`);
          break;
        }
        // Otherwise treat any non-5xx response as server ready (e.g., 200 OK, 404 Not Found)
        if (status >= 200 && status < 500) {
          serverReady = true;
          console.log(`✅ Server is ready (status ${status})`);
          break;
        } else {
          console.log(`ℹ️ Server responded with status ${status}, retrying...`);
        }
      }

      // If we reached here, treat as not ready and decrement retries
      retries--;
    } catch (error) {
      console.log(`❌ Server not ready at ${baseURL}: ${error.message}`);
      retries--;
    }

    // If pointing to localhost and failing repeatedly, fallback to production once
    // Only fallback to production if baseURL was not explicitly provided
    // Only attempt alternate ports / production fallback when NO explicit base env provided
    if (!serverReady && isLocal(baseURL) && !explicitBaseEnv) {
      if (/:3000\/?$/.test(baseURL) && fallbackIndex < localFallbacks.length) {
        const alt = localFallbacks[fallbackIndex](baseURL);
        fallbackIndex++;
        console.log(`🔁 Trying alternate local port: ${alt}`);
        baseURL = alt;
        process.env.PLAYWRIGHT_BASE_URL = baseURL;
        attemptedFallback = true;
      } else if (attemptedFallback && retries <= 6) {
        console.log('🔁 Falling back to production baseURL https://osvm.ai');
        baseURL = 'https://osvm.ai';
        process.env.PLAYWRIGHT_BASE_URL = baseURL;
      }
    }
    if (!serverReady && retries > 0) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  if (!serverReady) {
    throw new Error('Server failed to start within timeout period');
  }

  // Pre-load critical resources to improve test performance
  try {
    console.log('🔄 Pre-loading critical resources...');
    await page.goto(`${baseURL}/?ai=1`, {
      timeout: 20000,
      waitUntil: 'domcontentloaded'
    });
    console.log('✅ Critical resources pre-loaded');
  } catch (error) {
    console.warn('⚠️ Pre-loading failed, but continuing with tests:', (error as any)?.message);
  }

  await context.close();
  await browser.close();

  console.log('✅ Global setup completed');
}

export default globalSetup;
