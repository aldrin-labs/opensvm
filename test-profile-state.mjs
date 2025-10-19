import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('Loading profile page...');
    await page.goto('http://localhost:3000/user/11111111111111111111111111111111', { 
      waitUntil: 'domcontentloaded', 
      timeout: 60000 
    });
    
    await page.waitForTimeout(8000);
    
    // Check for loading state
    const loadingText = await page.locator('text=Loading').count();
    console.log(`Loading indicators: ${loadingText}`);
    
    // Check for error state
    const errorText = await page.locator('text=/Error|error/i').count();
    console.log(`Error indicators: ${errorText}`);
    
    // Check for profile content
    const profileText = await page.locator('text=/Profile|profile/i').first().textContent().catch(() => null);
    console.log(`Profile text: ${profileText}`);
    
    // Get page title
    const title = await page.title();
    console.log(`Page title: ${title}`);
    
    // Check if tabs list exists
    const tabsList = await page.locator('[role="tablist"]').count();
    console.log(`Tab lists found: ${tabsList}`);
    
    // Get all visible text on the page (first 1000 chars)
    const bodyText = await page.locator('body').textContent();
    console.log('Page text (first 500 chars):', bodyText?.slice(0, 500));
    
    await page.screenshot({ path: '/tmp/profile-debug.png', fullPage: true });
    console.log('Debug screenshot saved');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
