import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  try {
    console.log('Loading profile page...');
    await page.goto('http://localhost:3000/user/11111111111111111111111111111111', { 
      waitUntil: 'networkidle', 
      timeout: 90000 
    });
    
    console.log('Page loaded');
    
    // Close any modal/overlay that might be open
    console.log('Looking for modals/overlays to close...');
    
    // Try to find and click close buttons
    const closeButtons = page.locator('button:has-text("Close"), button:has-text("✕"), button:has-text("×"), [aria-label="Close"]');
    const closeCount = await closeButtons.count();
    console.log(`Found ${closeCount} potential close buttons`);
    
    for (let i = 0; i < closeCount; i++) {
      try {
        await closeButtons.nth(i).click({ timeout: 2000 });
        console.log(`Clicked close button ${i}`);
        await page.waitForTimeout(500);
      } catch (e) {
        // Button might not be clickable
      }
    }
    
    // Press Escape key to close any modals
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
    
    // Try clicking outside the modal if it still exists
    const overlay = page.locator('.fixed.inset-0');
    if (await overlay.count() > 0) {
      console.log('Overlay still present, trying to click it...');
      try {
        await overlay.first().click({ force: true, timeout: 2000 });
        await page.waitForTimeout(500);
      } catch (e) {
        console.log('Could not click overlay');
      }
    }
    
    console.log('Attempting to click Feed tab...');
    const feedButton = page.locator('button:has-text("Feed")').first();
    
    // Force click if needed
    await feedButton.click({ force: true, timeout: 5000 });
    console.log('Feed tab clicked!');
    
    await page.waitForTimeout(3000);
    
    // Check what's visible after clicking
    const forYou = await page.locator('text=For You').count();
    const following = await page.locator('text=Following').count();
    console.log(`For You: ${forYou}, Following: ${following}`);
    
    await page.screenshot({ path: '/tmp/feed-tab-opened.png', fullPage: true });
    console.log('✅ Screenshot saved: /tmp/feed-tab-opened.png');
    
    if (forYou > 0 || following > 0) {
      console.log('✅ SUCCESS: Feed tab is now loading and displaying content!');
    } else {
      console.log('⚠️ Feed tab clicked but content may not be fully visible yet');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    await page.screenshot({ path: '/tmp/error-final.png', fullPage: true });
  } finally {
    await browser.close();
  }
})();
