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
  
  // Wait for server to be ready with retries
  const baseURL = config.projects[0].use.baseURL || 'http://localhost:3000';
  let retries = 10;
  let serverReady = false;
  
  while (retries > 0 && !serverReady) {
    try {
      console.log(`Checking server readiness... (${retries} retries left)`);
      const response = await page.goto(baseURL, { timeout: 10000 });
      if (response?.ok()) {
        serverReady = true;
        console.log('✅ Server is ready');
      }
    } catch (error) {
      console.log(`❌ Server not ready: ${error.message}`);
      retries--;
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
  
  if (!serverReady) {
    throw new Error('Server failed to start within timeout period');
  }
  
  // Pre-load critical resources to improve test performance
  try {
    console.log('🔄 Pre-loading critical resources...');
    await page.goto(`${baseURL}/account/DtdSSG8ZJRZVv5Jx7K1MeWp7Zxcu19GD5wQRGRpQ9uMF`, { 
      timeout: 30000,
      waitUntil: 'domcontentloaded' 
    });
    console.log('✅ Critical resources pre-loaded');
  } catch (error) {
    console.warn('⚠️ Pre-loading failed, but continuing with tests:', error.message);
  }
  
  await context.close();
  await browser.close();
  
  console.log('✅ Global setup completed');
}

export default globalSetup;