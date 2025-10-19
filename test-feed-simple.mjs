import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Listen for console messages
  page.on('console', msg => console.log('BROWSER:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  try {
    console.log('Navigating to profile page...');
    await page.goto('http://localhost:3000/user/11111111111111111111111111111111', { 
      waitUntil: 'domcontentloaded', 
      timeout: 60000 
    });
    
    console.log('Page loaded, waiting for content...');
    await page.waitForTimeout(5000);
    
    // Take initial screenshot
    await page.screenshot({ path: '/tmp/profile-page.png', fullPage: true });
    console.log('Screenshot saved: /tmp/profile-page.png');
    
    // Look for the Feed tab
    const feedTabVisible = await page.locator('button', { hasText: 'Feed' }).isVisible().catch(() => false);
    console.log(`Feed tab visible: ${feedTabVisible}`);
    
    if (feedTabVisible) {
      console.log('Clicking Feed tab...');
      await page.locator('button', { hasText: 'Feed' }).first().click();
      await page.waitForTimeout(5000);
      
      // Take screenshot of feed tab
      await page.screenshot({ path: '/tmp/feed-tab.png', fullPage: true });
      console.log('Feed tab screenshot saved: /tmp/feed-tab.png');
      
      // Check for "For You" or "Following" buttons which indicate the feed is loading
      const forYouVisible = await page.locator('text=For You').isVisible().catch(() => false);
      const followingVisible = await page.locator('text=Following').isVisible().catch(() => false);
      
      console.log(`For You tab visible: ${forYouVisible}`);
      console.log(`Following tab visible: ${followingVisible}`);
      
      if (forYouVisible || followingVisible) {
        console.log('✅ Feed tab is loading correctly!');
      } else {
        console.log('⚠️ Feed tab opened but content may not be visible');
      }
    } else {
      console.log('❌ Feed tab button not found');
    }
    
  } catch (error) {
    console.error('Test error:', error.message);
    await page.screenshot({ path: '/tmp/error-screenshot.png', fullPage: true });
  } finally {
    await browser.close();
  }
})();
